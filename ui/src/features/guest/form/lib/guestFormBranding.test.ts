import { describe, expect, it } from 'vitest';

import {
  formatResidenceShortName,
  resolveGuestFormLogoUrl,
  formatPaidParkingDescription,
  formatNoPaidParkingDescription,
  formatPetPolicyTitle,
  formatPetFeeLine,
  formatGafEmailHint,
  formatGuestFooterLabel,
  formatParkingStepHint,
  formatGuestSuccessAdministration,
  formatPayParkingLastMinuteWarning,
  resolveGuestCopy,
  formatGuestContactHelp,
  formatGuestMessengerReturn,
  formatGuestCopyPasteHint,
  formatGuestLockedChangeHint,
  formatGuestStayThanks,
  formatGuestFarewell,
  pickGuestBrandHeaderProps,
  pickGuestOperationalHeaderProps,
  PLATFORM_BRAND_NAME,
} from '@/features/guest/form/lib/guestFormBranding';

describe('formatResidenceShortName', () => {
  it('formatResidenceShortName is exported', () => {
    expect(typeof formatResidenceShortName).toBe('function');
  });
});

describe('resolveGuestFormLogoUrl', () => {
  it('resolveGuestFormLogoUrl is exported', () => {
    expect(typeof resolveGuestFormLogoUrl).toBe('function');
  });
});

describe('formatPaidParkingDescription', () => {
  it('formatPaidParkingDescription is exported', () => {
    expect(typeof formatPaidParkingDescription).toBe('function');
  });
});

describe('formatNoPaidParkingDescription', () => {
  it('formatNoPaidParkingDescription is exported', () => {
    expect(typeof formatNoPaidParkingDescription).toBe('function');
  });
});

describe('formatPetPolicyTitle', () => {
  it('formatPetPolicyTitle is exported', () => {
    expect(typeof formatPetPolicyTitle).toBe('function');
  });
});

describe('formatPetFeeLine', () => {
  it('formatPetFeeLine is exported', () => {
    expect(typeof formatPetFeeLine).toBe('function');
  });
});

describe('formatGafEmailHint', () => {
  it('formatGafEmailHint is exported', () => {
    expect(typeof formatGafEmailHint).toBe('function');
  });
});

describe('formatGuestFooterLabel', () => {
  it('formatGuestFooterLabel is exported', () => {
    expect(typeof formatGuestFooterLabel).toBe('function');
  });
});

describe('formatParkingStepHint', () => {
  it('formatParkingStepHint is exported', () => {
    expect(typeof formatParkingStepHint).toBe('function');
  });
});

describe('formatGuestSuccessAdministration', () => {
  it('formatGuestSuccessAdministration is exported', () => {
    expect(typeof formatGuestSuccessAdministration).toBe('function');
  });
});

describe('formatPayParkingLastMinuteWarning', () => {
  it('formatPayParkingLastMinuteWarning is exported', () => {
    expect(typeof formatPayParkingLastMinuteWarning).toBe('function');
  });
});

describe('formatGuestContactHelp', () => {
  it('formatGuestContactHelp is exported', () => {
    expect(typeof formatGuestContactHelp).toBe('function');
  });
});

describe('formatGuestMessengerReturn', () => {
  it('formatGuestMessengerReturn is exported', () => {
    expect(typeof formatGuestMessengerReturn).toBe('function');
  });
});

describe('formatGuestCopyPasteHint', () => {
  it('formatGuestCopyPasteHint is exported', () => {
    expect(typeof formatGuestCopyPasteHint).toBe('function');
  });
});

describe('formatGuestLockedChangeHint', () => {
  it('formatGuestLockedChangeHint is exported', () => {
    expect(typeof formatGuestLockedChangeHint).toBe('function');
  });
});

describe('formatGuestStayThanks', () => {
  it('formatGuestStayThanks is exported', () => {
    expect(typeof formatGuestStayThanks).toBe('function');
  });
});

describe('formatGuestFarewell', () => {
  it('formatGuestFarewell is exported', () => {
    expect(typeof formatGuestFarewell).toBe('function');
  });
});

describe('pickGuestBrandHeaderProps', () => {
  it('pickGuestBrandHeaderProps is exported', () => {
    expect(typeof pickGuestBrandHeaderProps).toBe('function');
  });
});

describe('pickGuestOperationalHeaderProps', () => {
  it('pickGuestOperationalHeaderProps is exported', () => {
    expect(typeof pickGuestOperationalHeaderProps).toBe('function');
  });
});

describe('PLATFORM_BRAND_NAME', () => {
  it('is defined', () => {
    expect(PLATFORM_BRAND_NAME).toBeDefined();
  });
});

describe('resolveGuestCopy', () => {
  it('falls back to the built-in copy when the residence sets nothing', () => {
    expect(resolveGuestCopy({ copy: {} }, 'guestForm.pets.policyTitle', 'Built-in title')).toBe(
      'Built-in title'
    );
    expect(resolveGuestCopy(undefined, 'guestForm.pets.policyTitle', 'Built-in title')).toBe(
      'Built-in title'
    );
  });

  it('prefers the residence override, trimmed', () => {
    expect(
      resolveGuestCopy(
        { copy: { 'guestForm.pets.policyTitle': '  HOA pet rules  ' } },
        'guestForm.pets.policyTitle',
        'Built-in title'
      )
    ).toBe('HOA pet rules');
  });

  it('ignores a blank stored value instead of rendering an empty string', () => {
    expect(
      resolveGuestCopy(
        { copy: { 'guestForm.pets.policyTitle': '   ' } },
        'guestForm.pets.policyTitle',
        'Built-in title'
      )
    ).toBe('Built-in title');
  });
});
