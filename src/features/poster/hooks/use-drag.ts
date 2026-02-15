import { useCallback, useRef } from "react";

type DragTarget =
  | { type: "photo" }
  | { type: "name" }
  | { type: "role"; index: number }
  | null;

interface DragCallbacks {
  onPhotoDrag: (dx: number, dy: number) => void;
  onNameDrag: (dx: number, dy: number) => void;
  onRoleDrag: (index: number, dx: number, dy: number) => void;
  onDragEnd: () => void;
  clampDragDelta: (
    target: HTMLElement,
    dx: number,
    dy: number,
  ) => { dx: number; dy: number };
}

export function useDrag(callbacks: DragCallbacks) {
  const dragTargetRef = useRef<DragTarget>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const onPhotoPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragTargetRef.current = { type: "photo" };
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      const el = event.currentTarget;
      el.setPointerCapture(event.pointerId);
      el.classList.add("cursor-grabbing");
      el.classList.remove("cursor-grab");
    },
    [],
  );

  const onPhotoPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragTargetRef.current || dragTargetRef.current.type !== "photo")
        return;
      const dx = event.clientX - startXRef.current;
      const dy = event.clientY - startYRef.current;
      callbacks.onPhotoDrag(dx, dy);
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
    },
    [callbacks],
  );

  const onPhotoPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragTargetRef.current || dragTargetRef.current.type !== "photo")
        return;
      dragTargetRef.current = null;
      const el = event.currentTarget;
      el.classList.remove("cursor-grabbing");
      el.classList.add("cursor-grab");
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const onNamePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragTargetRef.current = { type: "name" };
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      const el = event.currentTarget;
      el.setPointerCapture(event.pointerId);
      el.classList.add("cursor-grabbing");
      el.classList.remove("cursor-grab");
    },
    [],
  );

  const onNamePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragTargetRef.current || dragTargetRef.current.type !== "name")
        return;
      const dx = event.clientX - startXRef.current;
      const dy = event.clientY - startYRef.current;
      const nameEl = event.currentTarget;
      const clamped = callbacks.clampDragDelta(nameEl, dx, dy);
      callbacks.onNameDrag(clamped.dx, clamped.dy);
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
    },
    [callbacks],
  );

  const onNamePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragTargetRef.current || dragTargetRef.current.type !== "name")
        return;
      dragTargetRef.current = null;
      const el = event.currentTarget;
      el.classList.remove("cursor-grabbing");
      el.classList.add("cursor-grab");
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      callbacks.onDragEnd();
    },
    [callbacks],
  );

  const onRolePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      dragTargetRef.current = { type: "role", index };
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      const el = event.currentTarget;
      el.setPointerCapture(event.pointerId);
      el.classList.add("cursor-grabbing");
      el.classList.remove("cursor-grab");
    },
    [],
  );

  const onRolePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragTargetRef.current || dragTargetRef.current.type !== "role")
        return;
      const { index } = dragTargetRef.current;
      const dx = event.clientX - startXRef.current;
      const dy = event.clientY - startYRef.current;
      const roleEl = event.currentTarget;
      const clamped = callbacks.clampDragDelta(roleEl, dx, dy);
      callbacks.onRoleDrag(index, clamped.dx, clamped.dy);
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
    },
    [callbacks],
  );

  const onRolePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragTargetRef.current || dragTargetRef.current.type !== "role")
        return;
      dragTargetRef.current = null;
      const el = event.currentTarget;
      el.classList.remove("cursor-grabbing");
      el.classList.add("cursor-grab");
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      callbacks.onDragEnd();
    },
    [callbacks],
  );

  return {
    onNamePointerDown,
    onNamePointerMove,
    onNamePointerUp,
    onPhotoPointerDown,
    onPhotoPointerMove,
    onPhotoPointerUp,
    onRolePointerDown,
    onRolePointerMove,
    onRolePointerUp,
  };
}
