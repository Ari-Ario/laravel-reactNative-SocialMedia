<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Story;
use Illuminate\Support\Facades\Storage;

class CleanupExpiredStories extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    // protected $signature = 'app:cleanup-expired-stories';

    /**
     * The console command description.
     *
     * @var string
     */
    // protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    protected $signature = 'stories:cleanup';
    protected $description = 'Delete expired stories and their media files';

    public function handle()
    {
        $expiredStories = Story::where('expires_at', '<=', now())->get();

        foreach ($expiredStories as $story) {
            // Delete the media file from storage
            Storage::disk('public')->delete($story->media_path);
            
            // Delete the database record
            $story->delete();
        }

        $this->info("Cleaned up " . $expiredStories->count() . " expired stories.");
    }
}
