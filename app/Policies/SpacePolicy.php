<?php

namespace App\Policies;

use App\Models\User;
use App\Models\CollaborationSpace;
use App\Models\SpaceParticipation;
use Illuminate\Auth\Access\HandlesAuthorization;

class SpacePolicy
{
    use HandlesAuthorization;

    public function view(User $user, CollaborationSpace $space)
    {
        return SpaceParticipation::where('space_id', $space->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    public function update(User $user, CollaborationSpace $space)
    {
        $participation = SpaceParticipation::where('space_id', $space->id)
            ->where('user_id', $user->id)
            ->first();
            
        return $participation && in_array($participation->role, ['owner', 'moderator']);
    }

    public function delete(User $user, CollaborationSpace $space)
    {
        return $space->creator_id === $user->id;
    }

    public function invite(User $user, CollaborationSpace $space)
    {
        $participation = SpaceParticipation::where('space_id', $space->id)
            ->where('user_id', $user->id)
            ->first();
            
        return $participation && (
            in_array($participation->role, ['owner', 'moderator']) ||
            ($participation->permissions['can_invite'] ?? false)
        );
    }

    public function startCall(User $user, CollaborationSpace $space)
    {
        $participation = SpaceParticipation::where('space_id', $space->id)
            ->where('user_id', $user->id)
            ->first();
            
        return $participation && (
            in_array($participation->role, ['owner', 'moderator', 'participant']) ||
            ($participation->permissions['can_start_call'] ?? false)
        );
    }
}