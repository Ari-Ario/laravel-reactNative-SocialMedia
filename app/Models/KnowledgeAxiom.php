<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeAxiom extends Model
{
    protected $fillable = [
        'parent_axiom_id',
        'anti_thesis_id',
        'branch',
        'data_type',
        'source_type',
        'ast_signature',
        'domain_partition',
        'thesis_statement',
        'deductive_samples',
        'inductive_logic',
        'confidence_score',
        'status'
    ];

    protected $casts = [
        'deductive_samples' => 'array',
        'confidence_score' => 'float',
    ];

    // Dialectical Relationships
    public function parentAxiom()
    {
        return $this->belongsTo(KnowledgeAxiom::class, 'parent_axiom_id');
    }

    public function childrenAxioms()
    {
        return $this->hasMany(KnowledgeAxiom::class, 'parent_axiom_id');
    }

    public function antiThesis()
    {
        return $this->belongsTo(KnowledgeAxiom::class, 'anti_thesis_id');
    }

    public function contradictedBy()
    {
        return $this->hasMany(KnowledgeAxiom::class, 'anti_thesis_id');
    }
}
