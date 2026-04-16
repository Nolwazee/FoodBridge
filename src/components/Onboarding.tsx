import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldCheck, Building2, FileText, MapPin } from 'lucide-react';

interface OnboardingProps {
  profile: UserProfile;
  onComplete: () => void;
}

export default function Onboarding({ profile, onComplete }: OnboardingProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    registrationNumber: '',
    address: '',
    contactPerson: '',
    phoneNumber: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ...formData,
        onboardingCompleted: true,
        updatedAt: serverTimestamp()
      });
      toast.success("Onboarding completed! Your verification is now pending.");
      onComplete();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-[#E9F5F1] rounded-2xl mb-4">
            <ShieldCheck className="h-8 w-8 text-[#2D9C75]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {profile.role === 'ngo' ? 'NGO Verification' : 'Retailer Profile Setup'}
          </h1>
          <p className="text-gray-500 mt-2">
            {profile.role === 'ngo' 
              ? 'Please provide your organization details to begin the vetting process.' 
              : 'Please provide your business details to start listing surplus food.'}
          </p>
        </div>

        <Card className="border-none shadow-xl shadow-gray-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50 p-8">
            <CardTitle className="text-xl">Organization Details</CardTitle>
            <CardDescription>This information will be reviewed by our admin team.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {profile.role === 'ngo' ? 'Registration Number (NPO/NPC)' : 'Business Registration Number'}
                  </Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      required
                      placeholder="e.g. 123-456 NPO" 
                      className="pl-10 h-12 rounded-xl border-gray-100 focus:border-[#2D9C75] focus:ring-[#2D9C75]"
                      value={formData.registrationNumber}
                      onChange={e => setFormData({...formData, registrationNumber: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {profile.role === 'ngo' ? 'Organization Name' : 'Store/Business Name'}
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      disabled
                      value={profile.organizationName}
                      className="pl-10 h-12 rounded-xl border-gray-100 bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Physical Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    required
                    placeholder="Full street address" 
                    className="pl-10 h-12 rounded-xl border-gray-100 focus:border-[#2D9C75] focus:ring-[#2D9C75]"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact Person</Label>
                  <Input 
                    required
                    placeholder="Full name" 
                    className="h-12 rounded-xl border-gray-100 focus:border-[#2D9C75] focus:ring-[#2D9C75]"
                    value={formData.contactPerson}
                    onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</Label>
                  <Input 
                    required
                    type="tel"
                    placeholder="+27..." 
                    className="h-12 rounded-xl border-gray-100 focus:border-[#2D9C75] focus:ring-[#2D9C75]"
                    value={formData.phoneNumber}
                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {profile.role === 'ngo' ? 'Organization Mission' : 'Business Description'}
                </Label>
                <textarea 
                  required
                  placeholder={profile.role === 'ngo' ? "Tell us about your community feeding programs..." : "Tell us about what type of food your business typically handles..."} 
                  className="w-full min-h-[120px] p-4 rounded-xl border border-gray-100 focus:border-[#2D9C75] focus:ring-[#2D9C75] text-sm"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#2D9C75] hover:bg-[#258563] text-white h-14 rounded-xl font-bold text-lg shadow-lg shadow-[#2D9C75]/20"
              >
                {loading ? "Submitting..." : (profile.role === 'ngo' ? "Submit for Verification" : "Complete Profile Setup")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
