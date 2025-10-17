<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

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
}
