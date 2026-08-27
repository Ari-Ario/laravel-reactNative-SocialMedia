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
        // ─────────────────────────────────────────────────────────────────────────
        // DIALECTICAL ENGINE SINGLETONS
        // Each of these services is expensive to construct (DB/cache reads, object
        // graphs). Binding them as singletons means app() always returns the SAME
        // instance for the lifetime of an Octane worker — construction cost is paid
        // exactly once, not once per request.
        // ─────────────────────────────────────────────────────────────────────────

        // AxiomRegistry: calls Cache::remember('dialectical_axioms_graph') in __construct.
        // Without singleton: ~0.63ms overhead on every app(AxiomRegistry::class) call.
        $this->app->singleton(
            \App\Services\Dialectical\AxiomEngine\AxiomRegistry::class
        );

        // MathematicalASTParser: ~19ms constructor (AxiomRegistry + AlgebraicManipulator init).
        // Wherever it is needed via app(), the same instance is returned.
        $this->app->singleton(
            \App\Services\Dialectical\MathematicalASTParser::class
        );

        // NaturalLanguageIntentService: pure-PHP, cheap to construct, but binding as
        // singleton makes the in-process static request cache accumulate across all
        // callers without each creating a fresh instance.
        $this->app->singleton(
            \App\Services\NaturalLanguageIntentService::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot()
    {
        \Illuminate\Database\Eloquent\Model::preventLazyLoading(! app()->isProduction());

        // if (app()->environment('local')) {
        //     // Auto-refresh stories daily at midnight
        //     if (now()->format('H:i') === '00:00') {
        //         \Artisan::call('db:seed --class=StoriesTableSeeder');
        //     }
        // }
    }

// public function boot()
// {
//     ResetPassword::createUrlUsing(function ($user, string $token) {
//         return "myapp://reset-password?token=$token&email=" . urlencode($user->email);
//     });
// }
}