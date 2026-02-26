<?php
// app/Http/Controllers/WhiteboardController.php

namespace App\Http\Controllers;

use App\Models\CollaborationSpace;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardCursor;
use App\Events\WhiteboardElementAdded;
use App\Events\WhiteboardElementUpdated;
use App\Events\WhiteboardElementRemoved;
use App\Events\WhiteboardCleared;
use App\Events\WhiteboardCursorMoved;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class WhiteboardController extends Controller
{
    public function getElements($spaceId)
    {
        $space = CollaborationSpace::findOrFail($spaceId);
        $this->authorize('view', $space);

        $elements = WhiteboardElement::where('space_id', $spaceId)
            ->orderBy('created_at')
            ->get();

        return response()->json($elements);
    }

    public function addElement(Request $request, $spaceId)
    {
        $space = CollaborationSpace::findOrFail($spaceId);
        $this->authorize('update', $space);

        $request->validate([
            'type' => 'required|string',
            'data' => 'required|array',
            'version' => 'integer',
        ]);

        $element = WhiteboardElement::create([
            'id' => Str::uuid(),
            'space_id' => $spaceId,
            'user_id' => Auth::id(),
            'type' => $request->type,
            'data' => $request->data,
            'version' => $request->version ?? 1,
        ]);

        broadcast(new WhiteboardElementAdded($space, $element))->toOthers();

        return response()->json($element, 201);
    }

    public function updateElement(Request $request, $spaceId, $elementId)
    {
        $space = CollaborationSpace::findOrFail($spaceId);
        $this->authorize('update', $space);

        $element = WhiteboardElement::where('space_id', $spaceId)
            ->where('id', $elementId)
            ->firstOrFail();

        $request->validate([
            'data' => 'required|array',
            'version' => 'required|integer|gt:' . $element->version,
        ]);

        $element->update([
            'data' => $request->data,
            'version' => $request->version,
        ]);

        broadcast(new WhiteboardElementUpdated($space, $element))->toOthers();

        return response()->json($element);
    }

    public function removeElement($spaceId, $elementId)
    {
        $space = CollaborationSpace::findOrFail($spaceId);
        $this->authorize('update', $space);

        $element = WhiteboardElement::where('space_id', $spaceId)
            ->where('id', $elementId)
            ->firstOrFail();

        $element->delete();

        broadcast(new WhiteboardElementRemoved($space, $elementId))->toOthers();

        return response()->json(['message' => 'Element removed']);
    }

    public function clear(Request $request, $spaceId)
    {
        $space = CollaborationSpace::findOrFail($spaceId);
        $this->authorize('update', $space);

        WhiteboardElement::where('space_id', $spaceId)->delete();

        broadcast(new WhiteboardCleared($space, Auth::id()))->toOthers();

        return response()->json(['message' => 'Whiteboard cleared']);
    }

    public function updateCursor(Request $request, $spaceId)
    {
        $space = CollaborationSpace::findOrFail($spaceId);
        $userId = Auth::id();

        $request->validate([
            'x' => 'required|integer|min:0|max:10000',
            'y' => 'required|integer|min:0|max:10000',
        ]);

        WhiteboardCursor::updateOrCreate(
            ['space_id' => $spaceId, 'user_id' => $userId],
            ['x' => $request->x, 'y' => $request->y, 'updated_at' => now()]
        );

        broadcast(new WhiteboardCursorMoved(
            $space,
            $userId,
            $request->x,
            $request->y,
            Auth::user()->name
        ))->toOthers();

        return response()->json(['success' => true]);
    }
}