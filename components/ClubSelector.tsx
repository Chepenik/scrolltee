"use client";

import { CLUBS } from "@/lib/game/clubs";
import type { ClubId } from "@/lib/game/types";

type ClubSelectorProps = {
  selectedClubId: ClubId;
  disabled: boolean;
  onSelect: (clubId: ClubId) => void;
};

export function ClubSelector({ selectedClubId, disabled, onSelect }: ClubSelectorProps) {
  return (
    <section className="panel club-selector" aria-label="Club selector">
      <div className="selector-header">
        <span>Club Bag</span>
        <strong>[ / ] cycle</strong>
      </div>
      <div className="club-buttons">
        {CLUBS.map((club) => (
          <button
            className={`club-button ${selectedClubId === club.id ? "is-active" : ""}`}
            disabled={disabled}
            key={club.id}
            onClick={() => onSelect(club.id)}
            title={`${club.key}. ${club.name}`}
            type="button"
          >
            <strong>
              {club.key}. {club.shortName}
            </strong>
            <span>{club.maxDistance} yd</span>
          </button>
        ))}
      </div>
    </section>
  );
}
