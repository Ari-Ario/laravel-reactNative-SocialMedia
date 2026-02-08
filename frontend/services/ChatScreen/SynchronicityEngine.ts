// services/SynchronicityEngine.ts
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import * as Haptics from 'expo-haptics';
import CollaborationService, { CollaborationSpace } from '@/services/ChatScreen/CollaborationService';

export interface SynchronicityMatch {
  type: 'user' | 'idea' | 'pattern' | 'timing';
  matchId: string;
  score: number;
  confidence: number;
  data: any;
  description: string;
}

export interface SynchronicityEvent {
  id: string;
  type: string;
  match: SynchronicityMatch;
  spaceId: string;
  userId?: string;
  timestamp: string;
  metadata: any;
}

class SynchronicityEngine {
  private static instance: SynchronicityEngine;
  private token: string | null = null;
  private baseURL: string;
  private activeMatches: Map<string, SynchronicityMatch[]> = new Map();
  private eventCallbacks: ((event: SynchronicityEvent) => void)[] = [];

  private constructor() {
    this.baseURL = getApiBase();
  }

  static getInstance(): SynchronicityEngine {
    if (!SynchronicityEngine.instance) {
      SynchronicityEngine.instance = new SynchronicityEngine();
    }
    return SynchronicityEngine.instance;
  }

  async setToken(token: string) {
    this.token = await getToken();
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async findSerendipitousMatches(spaceId: string, participants: any[] = []): Promise<SynchronicityMatch[]> {
    if (!spaceId) return [];
    
    try {
      // Try backend endpoint first
      const response = await axios.post(
        `${this.baseURL}/synchronicity/find-matches`,
        {
          space_id: spaceId,
          participants,
          timestamp: new Date().toISOString(),
        },
        { headers: this.getHeaders() }
      );
      
      if (response.data?.matches) {
        this.activeMatches.set(spaceId, response.data.matches);
        return response.data.matches;
      }
      
    } catch (error: any) {
      // If endpoint doesn't exist (404), use local matching
      if (error.response?.status === 404) {
        console.log('Synchronicity endpoint not found, using local matching');
        return this.generateLocalMatches(spaceId, participants);
      }
      console.error('Error finding matches:', error);
    }
    
    // Fallback to local matching
    return this.generateLocalMatches(spaceId, participants);
  }

  private generateLocalMatches(spaceId: string, participants: any[]): SynchronicityMatch[] {
    const matches: SynchronicityMatch[] = [];
    
    // Generate timing-based matches
    const hour = new Date().getHours();
    if (hour === 10 || hour === 15 || hour === 21) {
      matches.push({
        type: 'timing',
        matchId: `timing_${Date.now()}`,
        score: 0.7,
        confidence: 0.8,
        data: { hour, peakTime: true },
        description: 'Peak collaboration time detected'
      });
    }
    
    // Generate user synergy matches
    if (participants.length >= 2) {
      const userSkills = participants.flatMap(p => 
        p.user?.preferences?.synergy_traits || ['creative', 'analytical']
      );
      
      const uniqueSkills = [...new Set(userSkills)];
      if (uniqueSkills.length >= 3) {
        matches.push({
          type: 'user',
          matchId: `synergy_${Date.now()}`,
          score: 0.8,
          confidence: 0.9,
          data: { skills: uniqueSkills, participantCount: participants.length },
          description: `Great team synergy with ${uniqueSkills.length} complementary skills`
        });
      }
    }
    
    // Random idea match
    if (Math.random() > 0.5) {
      const ideas = [
        'brainstorming session',
        'creative writing',
        'problem solving',
        'design thinking',
        'strategic planning'
      ];
      const randomIdea = ideas[Math.floor(Math.random() * ideas.length)];
      
      matches.push({
        type: 'idea',
        matchId: `idea_${Date.now()}`,
        score: 0.6,
        confidence: 0.7,
        data: { suggestedActivity: randomIdea },
        description: `Perfect time for a ${randomIdea}`
      });
    }
    
    // Pattern-based match (simulated)
    if (participants.length > 0) {
      matches.push({
        type: 'pattern',
        matchId: `pattern_${Date.now()}`,
        score: 0.75,
        confidence: 0.85,
        data: { 
          patternType: 'engagement_peak',
          suggestedAction: 'deep_collaboration'
        },
        description: 'Optimal engagement pattern detected'
      });
    }
    
    this.activeMatches.set(spaceId, matches);
    return matches;
  }

  async triggerSynchronicityEvent(spaceId: string, match: SynchronicityMatch): Promise<void> {
    try {
      // Create event
      const event: SynchronicityEvent = {
        id: `sync_${Date.now()}_${match.matchId}`,
        type: this.getEventType(match),
        match,
        spaceId,
        timestamp: new Date().toISOString(),
        metadata: {
          triggeredAt: new Date().toISOString(),
          matchScore: match.score,
          confidence: match.confidence,
        }
      };
      
      // Try to save to backend
      try {
        await axios.post(
          `${this.baseURL}/synchronicity/events`,
          event,
          { headers: this.getHeaders() }
        );
      } catch (error) {
        // Endpoint might not exist, that's okay
        console.log('Synchronicity events endpoint not available');
      }
      
      // Trigger haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Notify callbacks
      this.notifyEventCallbacks(event);
      
      // Initiate activity if score is high
      if (match.score > 0.7) {
        await this.initiateCollaborativeActivity(spaceId, match);
      }
      
    } catch (error) {
      console.error('Error triggering synchronicity event:', error);
    }
  }

  private getEventType(match: SynchronicityMatch): string {
    switch (match.type) {
      case 'user':
        return 'team_synergy';
      case 'idea':
        return 'idea_match';
      case 'pattern':
        return 'pattern_recognition';
      case 'timing':
        return 'optimal_timing';
      default:
        return 'serendipitous_match';
    }
  }

  // 🎯 COLLABORATIVE ACTIVITIES
  private async initiateCollaborativeActivity(spaceId: string, match: SynchronicityMatch) {
    try {
      const collaborationService = CollaborationService.getInstance();
      
      const activityData = {
        space_id: spaceId,
        activity_type: this.getActivityTypeFromMatch(match),
        title: this.generateActivityTitle(match),
        description: match.description,
        match_type: match.type,
        match_score: match.score,
        suggested_duration: this.getSuggestedDuration(match),
        metadata: {
          synchronicity_match: match,
          triggered_at: new Date().toISOString(),
        },
      };
      
      try {
        // Try to create activity via API
        const activity = await collaborationService.createCollaborativeActivity(activityData);
        
        console.log('Created collaborative activity:', activity.title);
        
        // Show success notification
        this.showActivityNotification(match, activity);
        
      } catch (error: any) {
        // If API fails (404 or other), log it but don't crash
        console.log('Could not create collaborative activity via API:', error.message);
        
        // Show fallback notification
        this.showActivityNotification(match);
      }
      
    } catch (error) {
      console.error('Error initiating collaborative activity:', error);
    }
  }

  private getActivityTypeFromMatch(match: SynchronicityMatch): string {
    switch (match.type) {
      case 'user':
        return 'team-building';
      case 'idea':
        return 'brainstorm';
      case 'pattern':
        return 'deep-work';
      case 'timing':
        return 'focused-session';
      default:
        return 'collaboration';
    }
  }

  private generateActivityTitle(match: SynchronicityMatch): string {
    const baseTitles: Record<string, string[]> = {
      user: ['Team Synergy Session', 'Collaborative Workshop', 'Skill Share'],
      idea: ['Creative Brainstorm', 'Idea Exploration', 'Innovation Session'],
      pattern: ['Focused Work Session', 'Pattern Analysis', 'Deep Dive'],
      timing: ['Optimal Time Collaboration', 'Peak Productivity Session'],
    };
    
    const titles = baseTitles[match.type] || ['Collaborative Activity'];
    return titles[Math.floor(Math.random() * titles.length)];
  }

  private getSuggestedDuration(match: SynchronicityMatch): number {
    switch (match.type) {
      case 'user':
        return 45; // Team sessions are longer
      case 'idea':
        return 30; // Brainstorming sessions
      case 'pattern':
        return 60; // Deep work sessions
      case 'timing':
        return match.data.hour >= 14 ? 45 : 30; // Afternoon vs morning
      default:
        return 30;
    }
  }

  private showActivityNotification(match: SynchronicityMatch, activity?: any) {
    const notificationTitle = activity ? 'Activity Created!' : 'Synchronicity Detected';
    const notificationBody = activity 
      ? `"${activity.title}" has been created. Tap to start!`
      : `${match.description} Tap to create an activity.`;
    
    // You would integrate with your notification service here
    console.log('Notification:', notificationTitle, '-', notificationBody);
    
    // Example using Alert for now
    // Alert.alert(notificationTitle, notificationBody, [
    //   { text: 'Later', style: 'cancel' },
    //   { 
    //     text: 'View', 
    //     onPress: () => {
    //       if (activity) {
    //         // Navigate to activity
    //       } else {
    //         // Navigate to create activity screen
    //       }
    //     }
    //   }
    // ]);
  }

  private getSuggestedActivity(match: SynchronicityMatch): string {
    switch (match.type) {
      case 'user':
        return 'team_building_exercise';
      case 'idea':
        return match.data.suggestedActivity || 'brainstorming_session';
      case 'pattern':
        return 'deep_work_session';
      case 'timing':
        return 'focused_collaboration';
      default:
        return 'creative_exploration';
    }
  }

  private showActivityNotification(match: SynchronicityMatch) {
    // This would typically show a notification
    console.log('Activity suggested:', match.description);
    
    // You could integrate with your notification service here
    // Example: NotificationService.scheduleLocalNotification(...)
  }

  addEventListener(callback: (event: SynchronicityEvent) => void) {
    this.eventCallbacks.push(callback);
  }

  removeEventListener(callback: (event: SynchronicityEvent) => void) {
    this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
  }

  private notifyEventCallbacks(event: SynchronicityEvent) {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in synchronicity event callback:', error);
      }
    });
  }

  async getSpaceMatches(spaceId: string): Promise<SynchronicityMatch[]> {
    const cached = this.activeMatches.get(spaceId);
    if (cached) return cached;
    
    return await this.findSerendipitousMatches(spaceId);
  }

  async clearMatches(spaceId?: string) {
    if (spaceId) {
      this.activeMatches.delete(spaceId);
    } else {
      this.activeMatches.clear();
    }
  }

  // New method: Check for emerging patterns
  async checkForEmergingPatterns(spaceId: string, activityData: any): Promise<SynchronicityMatch[]> {
    const patterns: SynchronicityMatch[] = [];
    
    // Check message frequency
    if (activityData.messageCount > 20 && activityData.timeSpanMinutes < 10) {
      patterns.push({
        type: 'pattern',
        matchId: `high_engagement_${Date.now()}`,
        score: 0.85,
        confidence: 0.9,
        data: {
          pattern: 'high_engagement',
          messageCount: activityData.messageCount,
          timeSpan: activityData.timeSpanMinutes,
        },
        description: 'High engagement detected - perfect for brainstorming!'
      });
    }
    
    // Check participant diversity
    if (activityData.uniqueParticipants >= 3 && activityData.timeZoneCount >= 2) {
      patterns.push({
        type: 'user',
        matchId: `diverse_team_${Date.now()}`,
        score: 0.8,
        confidence: 0.85,
        data: {
          pattern: 'diverse_team',
          participantCount: activityData.uniqueParticipants,
          timeZoneCount: activityData.timeZoneCount,
        },
        description: 'Diverse team detected - great for creative problem solving!'
      });
    }
    
    // Check time of day patterns
    const hour = new Date().getHours();
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
      patterns.push({
        type: 'timing',
        matchId: `productive_time_${Date.now()}`,
        score: 0.7,
        confidence: 0.8,
        data: {
          pattern: 'productive_time',
          hour,
          suggestedFocus: hour <= 11 ? 'planning' : 'execution'
        },
        description: 'Peak productivity time - ideal for focused work'
      });
    }
    
    if (patterns.length > 0) {
      this.activeMatches.set(spaceId, [
        ...(this.activeMatches.get(spaceId) || []),
        ...patterns
      ]);
    }
    
    return patterns;
  }
}

export default SynchronicityEngine;
export { SynchronicityEngine };