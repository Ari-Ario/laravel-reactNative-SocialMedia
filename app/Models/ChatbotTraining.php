<?php

// app/Models/ChatbotTraining.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\User;

class ChatbotTraining extends Model
{
    use SoftDeletes;
    protected $table = 'chatbot_training';

    protected $fillable = [
        'trigger',
        'response',
        'context',
        'keywords',
        'category',
        'subcategory',
        'branch',
        'domain_partition',
        'parent_thesis',
        'parent_axiom_id',
        'formal_proof',
        'knowledge_axiom_id',
        'promoted_at',
        'needs_review',
        'is_active',
        'trained_by',
        'assigned_to',
        'reviewed_by',
        'usage_count',
        'success_rate',
        'confidence_score',
        'tags',
        'last_used_at'
    ];

    protected $casts = [
        'keywords'          => 'array',
        'tags'              => 'array',
        'needs_review'      => 'boolean',
        'is_active'         => 'boolean',
        'last_used_at'      => 'datetime',
        'promoted_at'       => 'datetime',
        'confidence_score'  => 'float',
    ];

    public function trainer()
    {
        return $this->belongsTo(User::class, 'trained_by');
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * The KnowledgeAxiom this ticket was promoted to (if approved).
     */
    public function knowledgeAxiom()
    {
        return $this->belongsTo(\App\Models\KnowledgeAxiom::class, 'knowledge_axiom_id');
    }

    /**
     * Parent axiom selected during expert review.
     */
    public function parentAxiom()
    {
        return $this->belongsTo(\App\Models\KnowledgeAxiom::class, 'parent_axiom_id');
    }
}
