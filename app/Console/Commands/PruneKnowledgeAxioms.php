<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\KnowledgeAxiom;
use Carbon\Carbon;

class PruneKnowledgeAxioms extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dialectic:prune {--days=30 : The number of days to keep low-confidence synthesized theses}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prunes low-confidence (confidence_score < 0.5) synthesized theses that are older than a specific timeframe.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $days = (int) $this->option('days');
        
        $this->info("Starting Dialectical Storage Cleanup...");
        $this->info("Target: 'synthesized_thesis' records with confidence < 0.5 older than {$days} days.");
        
        $cutoffDate = Carbon::now()->subDays($days);
        
        $query = KnowledgeAxiom::where('status', 'synthesized_thesis')
            ->where('confidence_score', '<', 0.5)
            ->where('updated_at', '<', $cutoffDate);
            
        $count = $query->count();
        
        if ($count === 0) {
            $this->info("No stale axioms found. Storage is clean.");
            return 0;
        }
        
        if ($this->confirm("Found {$count} stale synthesized theses. Proceed with deletion?", true)) {
            $deleted = $query->delete();
            $this->info("Successfully pruned {$deleted} obsolete axioms from the Dialectical Engine.");
        } else {
            $this->info("Operation cancelled.");
        }

        return 0;
    }
}
