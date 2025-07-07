<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens; 

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',          // For @mentions
        'email',
        'password',
        'bio',
        'birthday',
        'gender', 
        'profile_photo',
        'cover_photo',
        'job_title',         // Professional title
        'company',           // Workplace
        'education',         // Education history (could be JSON)
        'website',           // Personal website
        'location',          // City/Country
        'phone',             // Contact number (optional)
        // 'social_links',      // JSON: {twitter: x, instagram: y}
        'is_private',        // Private account flag
        'is_admin',          // Admin role flag
        'theme_preference',  // Light/dark mode
        'locale', 
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // Added this method to control what user data gets returned
    public function toAuthArray()
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'profile_photo' => $this->profile_photo,
            // Add other safe-to-expose fields
        ];
    }

    public function viewedStories()
    {
        return $this->belongsToMany(Story::class, 'story_views')
            ->withTimestamps();
    }

    //for viewing profile of others with followers
    public function posts()
    {
        return $this->hasMany(Post::class);
    }

    public function followers()
    {
        return $this->belongsToMany(User::class, 'followers', 'following_id', 'follower_id')
            ->withTimestamps();
    }

    public function following()
    {
        return $this->belongsToMany(User::class, 'followers', 'follower_id', 'following_id')
            ->withTimestamps();
    }

}
