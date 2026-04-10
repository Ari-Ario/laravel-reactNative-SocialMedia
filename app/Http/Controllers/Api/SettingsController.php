<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Validator;

class SettingsController extends Controller
{
    /**
     * Get all settings and preferences for the authenticated user.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Ensure preferences exist
        if (!$user->preferences) {
            $user->preferences()->create();
            $user->load('preferences');
        }

        return response()->json([
            'user' => $user,
            'preferences' => $user->preferences
        ]);
    }

    /**
     * Update user account/profile settings.
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'username' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('users')->ignore($user->id)],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone' => 'sometimes|nullable|string|max:20',
            'bio' => 'sometimes|nullable|string|max:1000',
            'birthday' => 'sometimes|nullable|date',
            'gender' => 'sometimes|nullable|string|max:50',
            'job_title' => 'sometimes|nullable|string|max:255',
            'company' => 'sometimes|nullable|string|max:255',
            'education' => 'sometimes|nullable|string|max:255',
            'website' => 'sometimes|nullable|url|max:255',
            'location' => 'sometimes|nullable|string|max:255',
            'is_private' => 'sometimes|boolean',
            'social_links' => 'sometimes|nullable|array',
            'password' => 'sometimes|required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $request->except(['password', 'password_confirmation']);

        if ($request->has('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return response()->json([
            'message' => 'Settings updated successfully',
            'user' => $user->fresh()
        ]);
    }

    /**
     * Update user preferences.
     */
    public function updatePreferences(Request $request)
    {
        $user = $request->user();
        
        // Ensure preferences exist
        $preferences = $user->preferences ?: $user->preferences()->create();

        $preferences->update($request->all());

        return response()->json([
            'message' => 'Preferences updated successfully',
            'preferences' => $preferences->fresh()
        ]);
    }

    /**
     * Update user password.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();
        
        $user->update([
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'message' => 'Password updated successfully'
        ]);
    }

    /**
     * Delete user account.
     */
    public function destroy(Request $request)
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        
        // Revoke all tokens
        $user->tokens()->delete();
        
        $user->delete();

        return response()->json([
            'message' => 'Account deleted successfully'
        ]);
    }
}
