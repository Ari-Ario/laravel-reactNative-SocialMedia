<?php

namespace App\Events;

use App\Models\KnowledgeAxiom;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when an expert promotes a training ticket to a KnowledgeAxiom.
 * Broadcasts on the 'experts' private channel so all experts see the update in real-time.
 */
class AxiomPromoted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly KnowledgeAxiom $axiom) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('experts')];
    }

    public function broadcastAs(): string
    {
        return 'axiom.promoted';
    }

    public function broadcastWith(): array
    {
        return [
            'axiom_id'         => $this->axiom->id,
            'thesis_statement' => $this->axiom->thesis_statement,
            'branch'           => $this->axiom->branch,
            'domain_partition' => $this->axiom->domain_partition,
            'status'           => $this->axiom->status,
            'confidence_score' => $this->axiom->confidence_score,
        ];
    }
}
