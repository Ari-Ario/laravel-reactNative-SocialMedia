<?php

// app/Http/Controllers/ChatbotTrainingController.php
namespace App\Http\Controllers;

use App\Models\ChatbotTraining;
use Illuminate\Http\Request;

class ChatbotTrainingController extends Controller
{
    public function index(Request $request)
    {
        return ChatbotTraining::query()
            ->when($request->category, fn($q, $cat) => $q->where('category', $cat))
            ->when($request->search, fn($q, $s) => $q->where('trigger', 'like', "%$s%"))
            ->orderBy('needs_review', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'trigger' => 'required|string|max:255',
            'response' => 'required|string',
            'category' => 'nullable|string|max:50',
            'keywords' => 'nullable|array'
        ]);

        $training = ChatbotTraining::create([
            ...$data,
            'trained_by' => auth()->id(),
            'needs_review' => false,
            'is_active' => true
        ]);

        cache()->forget('learned_responses');
        
        return response()->json($training, 201);
    }

    public function update(Request $request, $id)
    {
        \Log::info('Update Request Data:', $request->all());
        
        $validated = $request->validate([
            'response' => 'sometimes|string',
            'category' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean'
        ]);
    
        \Log::info('Validated Data:', $validated);
    
        try {
            // Find the training record first
            $training = ChatbotTraining::findOrFail($id);
            
            // Update the record
            $training->update([
                'response' => $validated['response'] ?? $training->response,
                'category' => $validated['category'] ?? $training->category,
                'is_active' => $validated['is_active'] ?? $training->is_active,
                'needs_review' => $validated['needs_review'] ?? false,
            ]);
    
            \Log::info('Updated Record:', $training->toArray());
            
            cache()->forget('learned_responses');
            
            return response()->json([
                'success' => true,
                'data' => $training
            ]);
        } catch (\Exception $e) {
            \Log::error('Update Error:', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Update failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function bulkApprove(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        
        ChatbotTraining::whereIn('id', $request->ids)
            ->update(['needs_review' => false]);
            
        cache()->forget('learned_responses');
        
        return response()->json(['message' => 'Responses approved']);
    }

    public function needsReview()
    {
        return ChatbotTraining::where('needs_review', true)->count();
    }

    public function categories()
    {
        return ChatbotTraining::groupBy('category')
            ->whereNotNull('category')
            ->pluck('category');
    }
}