<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    //
    public function missedNotifications(Request $request) {
        $userId = $request->user()->id;
        $lastSeenTime = $request->query('last_seen_time'); // Optional: ISO8601 string

        $query = $request->user()->notifications();

        if ($lastSeenTime) {
            $query->where('created_at', '>', $lastSeenTime);
        } else {
            // Return notifications from last 7 days if no last_seen_time
            $query->where('created_at', '>', now()->subDays(7));
        }

        $notifications = $query->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(function ($notification) {
                $data = $notification->data;
                
                return [
                    'id' => $notification->id,
                    'type' => $data['type'] ?? 'unknown',
                    'title' => $data['title'] ?? 'Notification',
                    'message' => $data['message'] ?? '',
                    'data' => $data,
                    'userId' => $data['userId'] ?? null,
                    'postId' => $data['postId'] ?? null,
                    'postCaption' => $data['postCaption'] ?? null,
                    'commentId' => $data['commentId'] ?? null,
                    'avatar' => $data['profile_photo'] ?? null,
                    'isRead' => !is_null($notification->read_at),
                    'createdAt' => $notification->created_at->toISOString(),
                ];
            });

        return response()->json($notifications);
    }

    
    /**
     * Register device for push notifications
     */
    public function registerDevice(Request $request)
    {
        $request->validate([
            'device_token' => 'required|string',
            'device_type' => 'required|in:ios,android,web',
            'device_name' => 'sometimes|string',
        ]);
        
        $user = auth()->user();
        
        // Store device token
        $user->update([
            'device_tokens' => array_merge(
                $user->device_tokens ?? [],
                [
                    [
                        'token' => $request->device_token,
                        'type' => $request->device_type,
                        'name' => $request->device_name,
                        'registered_at' => now()->toISOString(),
                    ]
                ]
            ),
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Device registered for push notifications',
        ]);
    }
    
    /**
     * Unregister device
     */
    public function unregisterDevice(Request $request)
    {
        $request->validate([
            'device_token' => 'required|string',
        ]);
        
        $user = auth()->user();
        $deviceToken = $request->device_token;
        
        // Remove device token
        $deviceTokens = $user->device_tokens ?? [];
        $filteredTokens = array_filter($deviceTokens, function($token) use ($deviceToken) {
            return $token['token'] !== $deviceToken;
        });
        
        $user->update([
            'device_tokens' => array_values($filteredTokens),
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Device unregistered',
        ]);
    }
    
    /**
     * Mark notification as read
     */
    public function markAsRead($id)
    {
        $notification = auth()->user()->notifications()->findOrFail($id);
        $notification->markAsRead();
        
        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read',
        ]);
    }
    
    /**
     * Mark all notifications as read
     */
    public function markAllAsRead()
    {
        auth()->user()->unreadNotifications->markAsRead();
        
        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read',
        ]);
    }
    
    /**
     * Clear all notifications
     */
    public function clearAll()
    {
        auth()->user()->notifications()->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'All notifications cleared',
        ]);
    }
    
    /**
     * Get notification preferences
     */
    public function getPreferences()
    {
        $user = auth()->user();
        $preferences = $user->preferences()->first();
        
        return response()->json([
            'preferences' => [
                'push_notifications' => $preferences->push_notifications ?? true,
                'email_notifications' => $preferences->email_notifications ?? true,
                'space_invitations' => true,
                'new_messages' => true,
                'magic_events' => true,
                'collaborative_activities' => true,
                'mentions' => true,
            ],
        ]);
    }
    
    /**
     * Update notification preferences
     */
    public function updatePreferences(Request $request)
    {
        $request->validate([
            'push_notifications' => 'boolean',
            'email_notifications' => 'boolean',
            'space_invitations' => 'boolean',
            'new_messages' => 'boolean',
            'magic_events' => 'boolean',
            'collaborative_activities' => 'boolean',
            'mentions' => 'boolean',
        ]);
        
        $user = auth()->user();
        $preferences = $user->preferences()->firstOrCreate([]);
        
        $preferences->update([
            'push_notifications' => $request->boolean('push_notifications', $preferences->push_notifications),
            'email_notifications' => $request->boolean('email_notifications', $preferences->email_notifications),
        ]);
        
        // Store other preferences in settings
        $settings = $preferences->settings ?? [];
        $settings['notifications'] = [
            'space_invitations' => $request->boolean('space_invitations', $settings['notifications']['space_invitations'] ?? true),
            'new_messages' => $request->boolean('new_messages', $settings['notifications']['new_messages'] ?? true),
            'magic_events' => $request->boolean('magic_events', $settings['notifications']['magic_events'] ?? true),
            'collaborative_activities' => $request->boolean('collaborative_activities', $settings['notifications']['collaborative_activities'] ?? true),
            'mentions' => $request->boolean('mentions', $settings['notifications']['mentions'] ?? true),
        ];
        
        $preferences->update(['settings' => $settings]);
        
        return response()->json([
            'success' => true,
            'message' => 'Notification preferences updated',
            'preferences' => $preferences,
        ]);
    }
}
