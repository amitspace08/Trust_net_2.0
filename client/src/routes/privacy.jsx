import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { db } from "../firebase/firebase";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "TrustNet - Privacy Guard" }],
  }),
  component: PrivacyPage,
});

function ToggleRow({ title, desc, checked, onChange, disabled }) {
  return (
    <div className={`flex items-start justify-between gap-4 p-5 transition-opacity ${disabled ? "opacity-60 grayscale-[30%]" : "opacity-100"}`}>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-900">{title}</p>
        <p className="font-medium text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
      </div>
      <Switch 
        checked={checked} 
        onCheckedChange={onChange} 
        disabled={disabled}
        className="data-[state=checked]:bg-indigo-600 mt-1"
      />
    </div>
  );
}

function PrivacyPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    liveSharing: true,
    bgLocation: true,
    autoAudio: false,
    layer2: true,
    retention: false,
  });
  const [loading, setLoading] = useState(true);

  // Real-time listener for privacy settings
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    const userRef = doc(db, "users", user.id);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.privacySettings) {
          setSettings(prev => ({
            ...prev,
            ...data.privacySettings
          }));
        }
      }
      setLoading(false);
    });
    
    return () => unsub();
  }, [user]);

  const updateSetting = async (key, val) => {
    // Optimistic UI update
    setSettings((prev) => ({ ...prev, [key]: val }));
    
    if (!user?.id) return;
    
    try {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        [`privacySettings.${key}`]: val
      }).catch(async (err) => {
        // If document doesn't exist or field doesn't exist, we might need to use setDoc with merge
        if (err.code === 'not-found') {
           await setDoc(userRef, {
              privacySettings: { [key]: val }
           }, { merge: true });
        } else {
           throw err;
        }
      });
      
    } catch (err) {
      console.error("Failed to update setting:", err);
      toast.error("Failed to sync setting to cloud");
      // Revert optimistic update
      setSettings((prev) => ({ ...prev, [key]: !val }));
    }
  };

  return (
    <div className="bg-[#faf9fc] text-gray-900 min-h-screen flex flex-col antialiased pb-20 md:pb-0">
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:pb-6 flex flex-col gap-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Privacy Guard</h1>
          <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
            Control who sees your live location, manage contacts data permissions, and adjust emergency metadata storage.
          </p>
        </div>

        {/* Toggles */}
        <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50/80 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
          <ToggleRow 
            title="Emergency Live Sharing" 
            desc="Automatically broadcast high-precision GPS coordinates to Layer 1 contacts when SOS is active." 
            checked={settings.liveSharing}
            onChange={(v) => updateSetting("liveSharing", v)}
            disabled={loading}
          />
          <ToggleRow 
            title="Background Location Access" 
            desc="Let TrustNet watch safety levels when the app runs in the background during late-night walks." 
            checked={settings.bgLocation}
            onChange={(v) => updateSetting("bgLocation", v)}
            disabled={loading}
          />
          <ToggleRow 
            title="Auto-Record Emergency Audio" 
            desc="Enable microphone recording automatically during SOS. Uploaded securely for your guardians." 
            checked={settings.autoAudio}
            onChange={(v) => updateSetting("autoAudio", v)}
            disabled={loading}
          />
          <ToggleRow 
            title="Layer 2 Discoverability" 
            desc="Allow friends of friends (Layer 2) to search for your safety score and mutual contacts." 
            checked={settings.layer2}
            onChange={(v) => updateSetting("layer2", v)}
            disabled={loading}
          />
          <ToggleRow 
            title="Data Retention Limit (7 days)" 
            desc="Automatically wipe location and event histories from cloud storage after 7 days." 
            checked={settings.retention}
            onChange={(v) => updateSetting("retention", v)}
            disabled={loading}
          />
        </section>
      </main>
    </div>
  );
}
