<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\Dialectical\Semantic\SemanticEngine;

class TrainDialecticalOntology extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dialectical:train-ontology';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Trains the Native PHP Mathematical-Linguistic TF-IDF Vector Space for the Dialectical Engine.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting Ontology Matrix Training...');
        
        $engine = new SemanticEngine();
        $engine->train();
        
        $this->info('Ontology Matrix successfully trained and saved. The Dialectical Engine can now dynamically retrieve mathematical parents!');
        return 0;
    }
}
