<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'profile_photo' => 'required|image|mimes:jpeg,png,jpg|max:20480'
        ]);

        $user = Auth::user();
        
        // Delete old photo if exists
        if ($user->profile_photo) {
            Storage::disk('public')->delete($user->profile_photo);
        }

        // Store new photo
        $path = $request->file('profile_photo')->store(
            'profile-photos/' . $user->id, 'public'
        );

        // Update user record
        $user->profile_photo = $path;
        $user->save();

        return response()->json([
            'message' => 'Profile photo updated',
            'path' => $path,
            'url' => Storage::url($path)
        ]);
    }

    public function deletePhoto()
    {
        $user = Auth::user();
        
        if ($user->profile_photo) {
            Storage::disk('public')->delete($user->profile_photo);
            $user->profile_photo = null;
            $user->save();
        }

        return response()->json(['message' => 'Profile photo removed']);
    }

    public function updateName(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $user = auth()->user();
        $user->name = $request->name;
        $user->save();

        return response()->json(['user' => $user]);
    }

}