import React from "react";
import Stepper from "../ui/Stepper";

interface CheckoutStepsProps {
  currentStep: number;
}

const steps = [
  { label: "ÉTAPE 01", title: "Livraison" },
  { label: "ÉTAPE 02", title: "Paiement" },
];

export default function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const step = steps[currentStep - 1] || steps[0];
  return (
    <Stepper
      currentStep={currentStep}
      totalSteps={2}
      label={step.label}
      title={step.title}
    />
  );
}
