<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot()
    {
        if (app()->environment('local')) {
            // Auto-refresh stories daily at midnight
            if (now()->format('H:i') === '00:00') {
                \Artisan::call('db:seed --class=StoriesTableSeeder');
            }
        }
    }

    // public function boot()
    // {
    //     ResetPassword::createUrlUsing(function ($user, string $token) {
    //         return "myapp://reset-password?token=$token&email=" . urlencode($user->email);
    //     });
    // }
}
