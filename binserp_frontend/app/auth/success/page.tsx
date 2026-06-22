"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { persistSession } from "@/src/lib/session";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Suspense } from "react";

function AuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const userType = searchParams.get("type");
    const encodedData = searchParams.get("data");

    if (token && userType && encodedData) {
      try {
        const decodedData = JSON.parse(atob(encodedData));

        persistSession({
          token,
          userType: userType as any,
          user: decodedData // The company object
        });

        // Redirect to dashboard immediately
        router.push("/dashboard");
      } catch (error) {
        console.error("Failed to parse auth data", error);
        router.push("/login?error=Invalid_Auth_Data");
      }
    } else {
      router.push("/login?error=Missing_Auth_Data");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center">
      <LoadingSpinner size="lg" />
      <h2 className="mt-4 text-xl font-semibold text-gray-700 dark:text-gray-300">
        Completing login...
      </h2>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}
