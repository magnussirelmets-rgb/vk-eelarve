"use client";

import { useState, useEffect, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // semikooloniga eraldatud, salvestamiseks
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function split(s: string): string[] {
  return s
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
function join(tags: string[]): string {
  return tags.join(";");
}

export function TagInput({ value, onChange, placeholder, className }: Props) {
  const [tags, setTags] = useState<string[]>(() => split(value));
  const [input, setInput] = useState("");

  useEffect(() => {
    setTags(split(value));
  }, [value]);

  function commit(newTags: string[]) {
    setTags(newTags);
    onChange(join(newTags));
  }
  function addCurrent() {
    const t = input.trim();
    if (!t) return;
    if (tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) {
      setInput("");
      return;
    }
    commit([...tags, t]);
    setInput("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      addCurrent();
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      commit(tags.slice(0, -1));
    }
  }
  function remove(idx: number) {
    commit(tags.filter((_, i) => i !== idx));
  }

  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className,
      )}
      onClick={(e) => {
        // Klõps tühjale alale → fookus sisendile
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "BUTTON") {
          (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus();
        }
      }}
    >
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="flex items-center gap-1 rounded bg-vk-blue/10 px-2 py-0.5 text-xs text-vk-blue"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded hover:bg-vk-blue/20"
            aria-label={`Eemalda "${tag}"`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={addCurrent}
        placeholder={tags.length === 0 ? placeholder : "Lisa veel… (Enter)"}
        className="min-w-[140px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
      />
    </div>
  );
}
