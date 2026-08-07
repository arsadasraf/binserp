"use client";

import { useState } from "react";
import HRPrefixSettingsForm from "../../components/forms/HRPrefixSettingsForm";
import ErrorAlert from "@/src/components/ErrorAlert";
import SuccessAlert from "@/src/components/SuccessAlert";

export default function HRSettingsPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess("")} />}
      <HRPrefixSettingsForm
        token={token}
        onSuccess={(msg) => setSuccess(msg)}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
