"use client";

import { CLUBS } from "@/lib/game/clubs";
import type { ClubId } from "@/lib/game/types";

type ClubSelectorProps = {
  selectedClubId: ClubId;
  disabled: boolean;
  onSelect: (clubId: ClubId) => void;
};

export function ClubSelector({ selectedClubId, disabled, onSelect }: ClubSelectorProps) {
  const selectedClub = CLUBS.find((club) => club.id === selectedClubId) ?? CLUBS[0];
  const categoryLabel =
    selectedClub.category === "wood"
      ? "Wood"
      : selectedClub.category === "iron"
        ? "Iron"
        : selectedClub.category === "wedge"
          ? "Wedge"
          : "Putter";

  return (
    <section className="panel club-selector" aria-label="Club selector">
      <div className="selector-header">
        <span>Club Bag</span>
        <strong>
          {selectedClub.shortName} {categoryLabel} / [ / ] cycle
        </strong>
      </div>
      <div className="club-buttons">
        {CLUBS.map((club) => (
          <button
            className={`club-button club-button-${club.category} ${selectedClubId === club.id ? "is-active" : ""}`}
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
