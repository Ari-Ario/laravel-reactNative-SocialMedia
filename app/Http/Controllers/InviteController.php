<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Mail\InvitationMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class InviteController extends Controller
{
    public function sendInvitation(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'message' => 'nullable|string|max:500',
        ]);

        try {
            $inviter = auth()->user();
            
            Mail::to($request->email)->send(new InvitationMail(
                $inviter->name ?? $inviter->username,
                $request->message
            ));

            return response()->json([
                'success' => true,
                'message' => 'Invitation sent successfully!'
            ]);
        } catch (\Exception $e) {
            Log::error('Invitation failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send invitation. Please try again.'
            ], 500);
        }
    }
}
