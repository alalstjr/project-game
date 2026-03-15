import BadgeIcon from './BadgeIcon.tsx';

interface ProfileAvatarProps {
  profileImage: string | null;
  size?: number;
  username?: string;
}

export default function ProfileAvatar({ profileImage, size = 28, username }: ProfileAvatarProps) {
  if (!profileImage) {
    // 기본: 유저네임 첫글자
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(108,92,231,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: 700,
        color: 'var(--accent-light)',
        border: '1px solid rgba(108,92,231,0.4)',
        flexShrink: 0,
      }}>
        {username?.charAt(0).toUpperCase() || '?'}
      </div>
    );
  }

  // 뱃지 프로필
  if (profileImage.startsWith('badge:')) {
    const badgeId = parseInt(profileImage.split(':')[1]);
    return <BadgeIcon badgeId={badgeId} size={size} />;
  }

  // 포켓몬 프로필
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'rgba(30,30,50,0.8)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <img
        src={profileImage}
        alt="profile"
        style={{ width: size * 0.85, height: size * 0.85, objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
}
