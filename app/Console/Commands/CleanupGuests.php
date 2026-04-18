<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class CleanupGuests extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'cleanup:guests {--hours=24 : Age of guests to remove in hours}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up temporary guest users older than specified hours';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $hours = $this->option('hours');
        $cutoff = now()->subHours($hours);

        $this->info("🧹 Cleaning up guest users created before {$cutoff}...");

        $query = User::where('username', 'like', 'guest_%')
            ->where('created_at', '<', $cutoff);

        $count = $query->count();

        if ($count === 0) {
            $this->info("✅ No old guest users found.");
            return 0;
        }

        $this->warn("⚠️ Found {$count} guest users to remove.");

        if ($this->confirm('Do you wish to proceed with the deletion?', true)) {
            // Delete users. Cascade deletes in the DB will handle relations.
            $deleted = $query->delete();
            
            $this->info("✅ Successfully deleted {$deleted} guest users.");
            Log::info("🧹 Guest Cleanup: Deleted {$deleted} users.");
        } else {
            $this->info("Operation cancelled.");
        }

        return 0;
    }
}
