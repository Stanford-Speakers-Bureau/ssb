"use client";

import { useState } from "react";

export function useNoBagsConfirmation(onConfirm: () => void) {
  const [showModal, setShowModal] = useState(false);
  const [noBagsConfirmation, setNoBagsConfirmation] = useState("");

  const openModal = () => {
    setShowModal(true);
    setNoBagsConfirmation("");
  };

  const handleConfirmNoBags = () => {
    if (noBagsConfirmation.toLowerCase().trim() === "no bags") {
      setShowModal(false);
      setNoBagsConfirmation("");
      onConfirm();
    }
  };

  const isConfirmDisabled =
    noBagsConfirmation.toLowerCase().trim() !== "no bags";

  return {
    showModal,
    setShowModal,
    openModal,
    noBagsConfirmation,
    setNoBagsConfirmation,
    handleConfirmNoBags,
    isConfirmDisabled,
  };
}
