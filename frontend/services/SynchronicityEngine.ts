// services/SynchronicityEngine.ts
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import axios from 'axios';
import getApiBase from './getApiBase';

interface SynchronicityMatch {
  user1: string;
  user2: string;
  compatibilityScore: number;
  matchType: 'idea' | 'skill' | 'mood' | 'opposite';
  suggestedActivity: string;
  magicEvent: string;
}

export class SynchronicityEngine {
  private static instance: SynchronicityEngine;
  private baseURL = getApiBase();

  static getInstance(): SynchronicityEngine {
    if (!SynchronicityEngine.instance) {
      SynchronicityEngine.instance = new SynchronicityEngine();
    }
    return SynchronicityEngine.instance;
  }

  async findSerendipitousMatches(spaceId: string, participants: any[]) {
    // Analyze participants for unexpected connections
    
    const matches: SynchronicityMatch[] = [];
    
    // Check for complementary skills
    if (participants){

        for (let i = 0; i < participants.length; i++) {
          for (let j = i + 1; j < participants.length; j++) {
            const user1 = participants[i];
            const user2 = participants[j];
            
            const compatibility = this.calculateCompatibility(user1, user2);
            
            if (compatibility.score > 0.7) {
              matches.push({
                user1: user1.id,
                user2: user2.id,
                compatibilityScore: compatibility.score,
                matchType: compatibility.type,
                suggestedActivity: this.generateActivity(compatibility.type),
                magicEvent: 'synchronicity_connection',
              });
            }
          }
        }
    }
    
    return matches;
  }

  private calculateCompatibility(user1: any, user2: any) {
    const traits1 = user1.synergy_traits || {};
    const traits2 = user2.synergy_traits || {};
    
    // Calculate multiple compatibility scores
    const skillComplementarity = this.calculateSkillComplementarity(traits1.skills, traits2.skills);
    const moodHarmony = this.calculateMoodHarmony(traits1.mood, traits2.mood);
    const ideaSimilarity = this.calculateIdeaSimilarity(user1.recentIdeas, user2.recentIdeas);
    
    const totalScore = (skillComplementarity + moodHarmony + ideaSimilarity) / 3;
    
    return {
      score: totalScore,
      type: this.determineMatchType(skillComplementarity, moodHarmony, ideaSimilarity),
    };
  }

  private generateActivity(matchType: 'idea' | 'skill' | 'mood' | 'opposite'): string {
    const activities = {
      idea: 'Brainstorm Session',
      skill: 'Skill Exchange',
      mood: 'Wellness Activity',
      opposite: 'Learning Challenge',
    };
    return activities[matchType];
  }

  private calculateSkillComplementarity(skills1: any, skills2: any): number {
    return 0.5;
  }

  private calculateMoodHarmony(mood1: any, mood2: any): number {
    return 0.5;
  }

  private calculateIdeaSimilarity(ideas1: any, ideas2: any): number {
    return 0.5;
  }

  private determineMatchType(skillComplementarity: number, moodHarmony: number, ideaSimilarity: number): 'idea' | 'skill' | 'mood' | 'opposite' {
    if (skillComplementarity > moodHarmony && skillComplementarity > ideaSimilarity) return 'skill';
    if (moodHarmony > ideaSimilarity) return 'mood';
    if (ideaSimilarity > 0.5) return 'idea';
    return 'opposite';
  }

  private getSpaceTypeForActivity(activity: string): string {
    return 'collaboration';
  }

  async triggerSynchronicityEvent(spaceId: string, match: SynchronicityMatch) {
    // Create a magical connection event
    
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    // Send to backend to create magic event
    await axios.post(`${this.baseURL}/spaces/${spaceId}/synchronicity`, {
      match,
      timestamp: new Date().toISOString(),
    });
    
    // Suggest collaborative activity
    Alert.alert(
      '✨ Synchronicity Discovered!',
      `${match.user1} and ${match.user2} have complementary ${match.matchType}!`,
      [
        { text: 'Ignore' },
        { 
          text: `Start ${match.suggestedActivity}`,
          onPress: () => this.initiateCollaborativeActivity(spaceId, match)
        },
      ]
    );
  }

  private async initiateCollaborativeActivity(spaceId: string, match: SynchronicityMatch) {
    // Auto-create a collaborative space for the matched users
    
    const activitySpace = await axios.post(`${this.baseURL}/spaces`, {
      title: `Synchronicity: ${match.suggestedActivity}`,
      space_type: this.getSpaceTypeForActivity(match.suggestedActivity),
      participant_ids: [match.user1, match.user2],
      settings: {
        is_synchronicity: true,
        auto_icebreaker: true,
      },
    });
    
    // Add AI prompt to get started
    await axios.post(`${this.baseURL}/spaces/${activitySpace.data.id}/ai-prompt`, {
      prompt: `Start a ${match.suggestedActivity} session for ${match.user1} and ${match.user2}. They have ${match.matchType} compatibility.`,
    });
    
    return activitySpace.data;
  }
}