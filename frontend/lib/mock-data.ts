export type NotificationType = 'analysis' | 'community' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  gender: string;
  ageGroup: string;
  country: string;
  city: string;
}

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'analysis',
    title: '팩트체크 완료',
    message: '서울시 대중교통 요금 인상 관련 소문의 진위가 확인되었습니다.',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 mins ago
    link: '/'
  },
  {
    id: 'notif-2',
    type: 'community',
    title: '새로운 댓글',
    message: '회원님의 "전기차 화재 관련 보도..." 게시글에 새로운 댓글이 달렸습니다.',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 mins ago
    link: '/community'
  },
  {
    id: 'notif-3',
    type: 'analysis',
    title: '검증 결과 도착',
    message: '정부 지원금 청년 일자리 수당 확대 정책의 실체 분석이 완료되었습니다.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    link: '/'
  },
  {
    id: 'notif-4',
    type: 'analysis',
    title: '분석 완료',
    message: '"최근 발생한 은행권 해킹 이슈"에 대한 검증이 완료되었습니다. 결과를 확인해보세요.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    link: '/'
  },
  {
    id: 'notif-5',
    type: 'system',
    title: '시스템 점검 안내',
    message: '원활한 서비스 제공을 위해 새벽 2시부터 4시까지 정기 점검이 진행됩니다.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() // 3 days ago
  }
];

export const mockUserProfile: UserProfile = {
  id: 'user-123',
  name: '홍길동',
  email: 'gildong.hong@example.com',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  gender: '남성',
  ageGroup: '30대',
  country: '대한민국',
  city: '서울특별시'
};
