import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LegalInfoForm } from '../components/client/LegalInfoForm';
import { ClientIntakeForm } from '../components/client/ClientIntakeForm';
import { AIProposalView } from '../components/client/AIProposalView';

export function ClientPortal() {
  const [step, setStep] = useState(1);
  const [legalData, setLegalData] = useState<any>(null);
  const [intakeData, setIntakeData] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);

  const { user, isProfileComplete } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return; // not logged in — show the public onboarding form normally

    if (user.role !== 'CUSTOMER') {
      // Staff who land on /client get sent to their dashboard
      navigate('/dashboard');
      return;
    }

    // CUSTOMER: only redirect away if their profile is already complete
    if (isProfileComplete) {
      navigate('/dashboard/customer');
    }
    // isProfileComplete === false → stay here and fill the form
  }, [user, isProfileComplete, navigate]);


  const handleLegalNext = (data: any) => {
    setLegalData(data);
    setStep(2);
  };

  const handleProposalGenerated = (proposalData: any, formIntakeData: any) => {
    setIntakeData(formIntakeData);
    setProposal(proposalData);
  };

  const steps = [
    { id: 1, name: 'البيانات القانونية' },
    { id: 2, name: 'بناء الهوية' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Progress Indicator */}
        <div className="max-w-sm sm:max-w-md md:max-w-2xl mx-auto mb-8 sm:mb-10 md:mb-12">
            <div className="relative flex justify-between">
              {steps.map((s) => (
                <div key={s.id} className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-500 ${
                    step >= s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border-2 border-slate-100'
                  }`}>
                    {s.id}
                  </div>
                  <span className={`mt-2 text-xs sm:text-sm font-medium ${step >= s.id ? 'text-blue-600' : 'text-slate-400'}`}>
                    {s.name}
                  </span>
                </div>
              ))}
              {/* Progress Line */}
              <div className="absolute top-4 sm:top-5 left-0 w-full h-0.5 bg-slate-100 -z-0" />
              <div 
                className="absolute top-4 sm:top-5 left-0 h-0.5 bg-blue-600 transition-all duration-500 -z-0" 
                style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>
          </div>

        {step === 1 && (
          <LegalInfoForm onNext={handleLegalNext} initialData={legalData} />
        )}

        {step === 2 && (
          proposal ? (
            <AIProposalView 
              proposal={proposal} 
              legalData={legalData}
              intakeData={intakeData}
            />
          ) : (
            <ClientIntakeForm
              legalData={legalData}
              onBack={() => setStep(1)}
              onProposalGenerated={handleProposalGenerated}
            />
          )
        )}
      </div>
    </div>
  );
}

