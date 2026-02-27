<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Media extends Model
{
    use HasFactory;

    protected $fillable = [
        'model_id',
        'model_type',
        'file_path',
        'type',
        'mime_type',
        'size',
        'original_name',
        'user_id',
        'metadata'
    ];

    protected $casts = [
        'metadata' => 'array'
    ];

    public function model()
    {
        return $this->morphTo();
    }

    public function getFullPathAttribute()
    {
        return storage_path('app/public/' . $this->file_path);
    }

    public function getUrlAttribute()
    {
        return asset('storage/' . $this->file_path);
    }
}