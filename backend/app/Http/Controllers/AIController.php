<?php

namespace App\Http\Controllers;

use App\Models\AiInteraction;
use App\Models\ChatbotTraining;
use App\Models\CollaborationSpace;
use App\Models\Post;
use App\Models\Story;
use App\Models\Comment;
use App\Models\Reaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class AIController extends Controller
{
    /**
     * Get AI interactions for user
     */
    public function getInteractions(Request $request)
    {
        $user = Auth::user();
        
        $interactions = AiInteraction::where('user_id', $user->id)
            ->with(['space', 'trainingMatch'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);
        
        return response()->json([
            'interactions' => $interactions,
            'stats' => [
                'total_interactions' => AiInteraction::where('user_id', $user->id)->count(),
                'helpful_count' => AiInteraction::where('user_id', $user->id)
                    ->where('was_helpful', true)->count(),
                'average_confidence' => AiInteraction::where('user_id', $user->id)
                    ->avg('confidence_score'),
            ]
        ]);
    }

    /**
     * Provide feedback on AI interaction
     */
    public function provideFeedback(Request $request, $interactionId)
    {
        $user = Auth::user();
        
        $interaction = AiInteraction::where('id', $interactionId)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        $request->validate([
            'was_helpful' => 'required|boolean',
            'feedback' => 'nullable|string',
            'suggested_improvement' => 'nullable|string',
        ]);
        
        $interaction->update([
            'was_helpful' => $request->was_helpful,
            'user_feedback' => [
                'text' => $request->feedback,
                'suggested_improvement' => $request->suggested_improvement,
                'provided_at' => now(),
            ],
        ]);
        
        // If feedback is negative and there was a training match, mark for review
        if (!$request->was_helpful && $interaction->training_match_id) {
            ChatbotTraining::where('id', $interaction->training_match_id)
                ->update(['needs_review' => true]);
        }
        
        // If feedback is positive, increase usage count
        if ($request->was_helpful && $interaction->training_match_id) {
            $training = ChatbotTraining::find($interaction->training_match_id);
            $training->increment('usage_count');
            
            // Update success rate
            $totalUses = $training->usage_count;
            $helpfulUses = AiInteraction::where('training_match_id', $training->id)
                ->where('was_helpful', true)
                ->count();
            
            $training->update([
                'success_rate' => $totalUses > 0 ? ($helpfulUses / $totalUses) * 100 : 0,
            ]);
        }
        
        return response()->json([
            'message' => 'Feedback submitted successfully',
            'interaction' => $interaction,
        ]);
    }

    /**
     * Learn from successful collaboration (called after successful space activities)
     */
    public function learnFromSpace(Request $request, $spaceId)
    {
        $user = Auth::user();
        
        // Check if user has permission
        $space = CollaborationSpace::where('id', $spaceId)
            ->where('creator_id', $user->id)
            ->firstOrFail();
        
        // Analyze space for patterns
        $patterns = $this->analyzeSpacePatterns($space);
        
        // Convert patterns to training data
        $newTrainingExamples = $this->convertPatternsToTraining($patterns, $space);
        
        // Add to chatbot_training
        foreach ($newTrainingExamples as $example) {
            ChatbotTraining::create([
                'trigger' => $example['trigger'],
                'response' => $example['response'],
                'context' => $space->space_type,
                'collaboration_context' => 'successful_pattern',
                'space_types' => [$space->space_type],
                'keywords' => $example['keywords'],
                'category' => 'collaboration_success',
                'trained_by' => $user->id,
                'is_active' => true,
            ]);
        }
        
        // Update space with learning data
        $space->update([
            'ai_learning_data' => array_merge(
                $space->ai_learning_data ?? [],
                [
                    'learned_at' => now(),
                    'patterns_extracted' => count($newTrainingExamples),
                    'patterns' => $patterns,
                ]
            ),
        ]);
        
        return response()->json([
            'learned_patterns' => $patterns,
            'new_training_examples' => count($newTrainingExamples),
            'message' => 'AI has learned from this space',
        ]);
    }

    /**
     * Enhance a post with AI suggestions
     */
    public function enhancePost(Request $request, $postId)
    {
        $user = Auth::user();
        
        $post = Post::where('id', $postId)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        // Analyze post
        $analysis = $this->analyzePost($post);
        
        // Generate suggestions
        $suggestions = [];
        
        if ($analysis['needs_improvement']) {
            $suggestions = [
                'add_question' => $this->suggestQuestion($post->caption),
                'hashtags' => $this->suggestHashtags($post->caption),
                'related_content' => $this->findRelatedContent($post),
            ];
        }
        
        // Predict engagement
        $predictedEngagement = $this->predictEngagement($post);
        
        // Find similar successful posts
        $similarPosts = $this->findSimilarSuccessfulPosts($post);
        
        return response()->json([
            'analysis' => $analysis,
            'suggestions' => $suggestions,
            'predicted_engagement' => $predictedEngagement,
            'similar_successful_posts' => $similarPosts,
            'message' => 'Post analysis complete',
        ]);
    }

    /**
     * Suggest story continuation
     */
    public function suggestStoryContinuation(Request $request, $storyId)
    {
        $user = Auth::user();
        
        $story = Story::where('id', $storyId)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        // Get story context
        $context = $this->getStoryContext($story);
        
        // Generate continuation suggestions
        $continuations = $this->generateStoryContinuations($story, $context);
        
        // If story is collaborative, consider other contributions
        if ($story->is_collaborative) {
            $collaborativeSuggestions = $this->getCollaborativeSuggestions($story);
            $continuations = array_merge($continuations, $collaborativeSuggestions);
        }
        
        return response()->json([
            'continuations' => $continuations,
            'context' => $context,
            'suggested_branches' => $this->suggestBranches($story),
            'message' => 'Story continuation suggestions generated',
        ]);
    }

    /**
     * Enhance comment with AI
     */
    public function enhanceComment(Request $request)
    {
        $request->validate([
            'comment_text' => 'required|string',
            'post_id' => 'required|exists:posts,id',
            'context' => 'nullable|array',
        ]);
        
        $post = Post::findOrFail($request->post_id);
        
        // Find training match for comment response
        $trainingMatch = $this->findTrainingMatchForComment(
            $request->comment_text, 
            $post, 
            $request->context ?? []
        );
        
        $enhancements = [
            'sentiment' => $this->analyzeSentiment($request->comment_text),
            'suggested_improvements' => $this->suggestCommentImprovements($request->comment_text),
            'suggested_reactions' => $this->suggestReactions($request->comment_text),
        ];
        
        if ($trainingMatch) {
            $enhancements['suggested_reply'] = $trainingMatch['response'];
            $enhancements['training_match_confidence'] = $trainingMatch['confidence'];
        }
        
        return response()->json([
            'enhancements' => $enhancements,
            'has_training_match' => !empty($trainingMatch),
            'message' => 'Comment analysis complete',
        ]);
    }

    /**
     * Helper: Analyze space for patterns
     */
    private function analyzeSpacePatterns($space)
    {
        $patterns = [];
        
        // Get all interactions in this space
        $interactions = AiInteraction::where('space_id', $space->id)
            ->where('was_helpful', true)
            ->get();
        
        // Get participants data
        $participations = $space->participations()
            ->with('user')
            ->get();
        
        // Analyze engagement patterns
        $engagementPatterns = $this->analyzeEngagementPatterns($participations);
        
        // Extract successful icebreakers
        $icebreakers = $this->extractIcebreakers($interactions, $space);
        
        // Extract decision patterns
        $decisions = $this->extractDecisions($space);
        
        // Extract conflict resolutions
        $resolutions = $this->extractResolutions($space);
        
        return [
            'engagement' => $engagementPatterns,
            'icebreakers' => $icebreakers,
            'decisions' => $decisions,
            'conflict_resolutions' => $resolutions,
            'total_interactions' => $interactions->count(),
            'successful_interactions' => $interactions->where('was_helpful', true)->count(),
        ];
    }

    /**
     * Helper: Convert patterns to training data
     */
    private function convertPatternsToTraining($patterns, $space)
    {
        $trainingExamples = [];
        
        // Convert icebreakers
        foreach ($patterns['icebreakers'] as $icebreaker) {
            $trainingExamples[] = [
                'trigger' => "The conversation is slow",
                'response' => "Try this icebreaker: {$icebreaker['text']}",
                'keywords' => ['slow', 'quiet', 'stuck', 'icebreaker'],
            ];
        }
        
        // Convert successful decisions
        foreach ($patterns['decisions'] as $decision) {
            $trainingExamples[] = [
                'trigger' => "We need to make a decision about {$decision['topic']}",
                'response' => "Consider this approach: {$decision['approach']}",
                'keywords' => ['decision', 'choose', 'option', $decision['topic']],
            ];
        }
        
        return $trainingExamples;
    }
}