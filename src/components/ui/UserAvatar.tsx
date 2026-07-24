import * as React from "react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-indigo-600 text-white",
  "bg-purple-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-teal-600 text-white",
  "bg-cyan-600 text-white"
];

export function getAvatarColor(name: string) {
  const cleanName = (name || "").trim();
  const charCode = cleanName.charCodeAt(0) || 0;
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  sizeClassName?: string;
  className?: string;
}

export function UserAvatar({
  name,
  avatarUrl,
  sizeClassName = "w-10 h-10 text-sm font-semibold",
  className,
}: UserAvatarProps) {
  const isPlaceholder = 
    !avatarUrl || 
    avatarUrl.includes("aida-public") || 
    avatarUrl.includes("dicebear");

  const initial = (name || "U").trim().charAt(0).toUpperCase();

  if (isPlaceholder) {
    const colorClass = getAvatarColor(name);
    return (
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold uppercase select-none shrink-0 border border-white/10",
          colorClass,
          sizeClassName,
          className
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className={cn("rounded-full object-cover shrink-0 select-none", sizeClassName, className)}
    />
  );
}
