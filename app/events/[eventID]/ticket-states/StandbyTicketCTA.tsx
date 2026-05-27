"use client";

import { motion } from "motion/react";
import { RedButton, ConfirmationModal, NoBagsModalChildren } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";
import { useNoBagsConfirmation } from "./useNoBagsConfirmation";

type StandbyTicketCTAProps = {
  isLoading: boolean;
  processStandbyTicketRequest: () => void;
  waitlistChance?: string | null;
};

export default function StandbyTicketCTA({
  isLoading,
  processStandbyTicketRequest,
  waitlistChance,
}: StandbyTicketCTAProps) {
  const noBags = useNoBagsConfirmation(processStandbyTicketRequest);
  const isHighChance = waitlistChance?.toLowerCase() === "high";

  return (
    <div>
      {/* Live badge */}
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
          Admitting Now
        </span>
      </span>

      <p className="text-md font-semibold text-white mb-1.5">
        The standby line is open!
      </p>
      <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-5">
        Grab a standby ticket below and head to the venue. You&apos;ll be
        admitted as spots become available. No guarantee, but many people get
        in.
      </p>

      {/* High chance indicator */}
      {isHighChance && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 p-3.5 relative overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/[0.07] to-emerald-400/0"
            animate={{ x: ["-100%", "100%"] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 1,
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-200">
                High chance of getting in
              </p>
              <p className="text-xs text-emerald-400">
                Based on past similar events
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* What to do */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
        {[
          "Get your standby ticket",
          "Head to the venue",
          "Join the standby line",
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-zinc-400">
                {i + 1}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{step}</p>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <RedButton
        onClick={noBags.openModal}
        disabled={isLoading}
        loading={isLoading}
        loadingText={TICKET_MESSAGES.CREATING}
      >
        Get Standby Ticket
      </RedButton>

      <ConfirmationModal
        open={noBags.showModal}
        onClose={() => noBags.setShowModal(false)}
        title="No Bags Policy"
        description="This event has a strict no bags policy. You will be turned away at the entrance with any form of a bag or purse."
        cancelLabel="Cancel"
        confirmLabel="Proceed"
        onConfirm={noBags.handleConfirmNoBags}
        confirmDisabled={noBags.isConfirmDisabled}
      >
        <NoBagsModalChildren
          value={noBags.noBagsConfirmation}
          onChange={noBags.setNoBagsConfirmation}
          onConfirm={noBags.handleConfirmNoBags}
        />
      </ConfirmationModal>
    </div>
  );
}
