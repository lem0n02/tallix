import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditProfileModal } from './components/EditProfileModal';
import { UserProfile } from './types';

const mockUser: UserProfile = {
  id: 'usr_lemon',
  name: 'Lemon',
  email: 'abdulatiflemon@gmail.com',
  role: 'Staff Engineer',
  systemRole: 'Admin',
  title: 'Lead Architect',
  department: 'Core Infrastructure',
  avatarGradient: 'from-emerald-600 to-teal-500',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  liquidityLimit: 30000,
  currentLiquidity: 12000,
  monthlyBurnRate: 4500,
};

describe('Profile Edit UI Cleanup and Simplification', () => {
  it('renders ONLY the 4 required sections: Profile Picture, Full Name, Email, Monthly Budget', () => {
    const html = renderToString(
      <EditProfileModal
        isOpen={true}
        onClose={vi.fn()}
        user={mockUser}
        onSaveUser={vi.fn()}
      />
    );

    // 1. Profile Picture section
    expect(html).toContain('Profile Picture');
    expect(html).toContain('Upload Picture');
    expect(html).toContain('Supports JPG, PNG or WEBP up to 5MB');

    // 2. Full Name section (Read-only)
    expect(html).toContain('Full Name');
    expect(html).toContain('value="Lemon"');
    expect(html).toContain('readOnly');

    // 3. Email section (Read-only, labeled "Email")
    expect(html).toContain('Email');
    expect(html).toContain('value="abdulatiflemon@gmail.com"');

    // 4. Monthly Budget section
    expect(html).toContain('Monthly Budget');
    expect(html).toContain('value="30000"');

    // Action buttons
    expect(html).toContain('Cancel');
    expect(html).toContain('Save Changes');
  });

  it('completely removes Job Title, Department, Corporate Email, and Fallback Gradient Color', () => {
    const html = renderToString(
      <EditProfileModal
        isOpen={true}
        onClose={vi.fn()}
        user={mockUser}
        onSaveUser={vi.fn()}
      />
    );

    // Removed fields
    expect(html).not.toContain('Job Title');
    expect(html).not.toContain('Department');
    expect(html).not.toContain('Corporate Email');
    expect(html).not.toContain('Fallback Gradient Color');
    expect(html).not.toContain('Emerald Teal');
    expect(html).not.toContain('Blue Indigo');
    expect(html).not.toContain('Violet Purple');
    expect(html).not.toContain('Super Administrator');
    expect(html).not.toContain('Staff Software Architect');
  });

  it('ensures Full Name and Email are strictly marked as read-only', () => {
    const html = renderToString(
      <EditProfileModal
        isOpen={true}
        onClose={vi.fn()}
        user={mockUser}
        onSaveUser={vi.fn()}
      />
    );

    // Both fields must contain readOnly and disabled flags
    expect(html).toMatch(/id="profile-full-name-input"[^>]*readOnly/);
    expect(html).toMatch(/id="profile-email-input"[^>]*readOnly/);
    expect(html).toContain('Read-only');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToString(
      <EditProfileModal
        isOpen={false}
        onClose={vi.fn()}
        user={mockUser}
        onSaveUser={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
