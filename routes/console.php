<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\User;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('cleanup:guests --hours=72')->dailyAt('01:00');
Schedule::command('dialectic:prune --days=30')->weeklyOn(0, '02:00');

Artisan::command('dump:axioms', function () {
    $axioms = DB::table('knowledge_axioms')->select('id', 'thesis_statement', 'domain_partition')->get();
    file_put_contents('all_db_axioms.json', json_encode($axioms, JSON_PRETTY_PRINT));
    $this->info('Dumped axioms.');
});
