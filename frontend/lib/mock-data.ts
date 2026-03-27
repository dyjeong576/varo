export type NotificationType = 'analysis' | 'community' | 'system';
import { PopularTopic } from './types/popular';
import { CommunityPost, CommunityComment } from './types/community';

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

export const mockPopularTopics: PopularTopic[] = [
  {
    id: 'pop-1',
    rank: 1,
    title: '서울시 대중교통 요금 인상, 정말 확정된 사안인가요?',
    requestCount: 3402,
    trend: 'up',
    trendValue: 12.4,
    updatedAt: '방금 전',
    isHot: true
  },
  {
    id: 'pop-2',
    rank: 2,
    title: '모바일 신분증 도입 후 기존 실물 신분증 효력이 상실되나요?',
    requestCount: 2118,
    trend: 'up',
    trendValue: 5.2,
    updatedAt: '12분 전'
  },
  {
    id: 'pop-3',
    rank: 3,
    title: '정부 지원금 청년 일자리 수당 확대 정책의 실체',
    requestCount: 1895,
    trend: 'steady',
    updatedAt: '45분 전'
  },
  {
    id: 'pop-4',
    rank: 4,
    title: '전기차 지하 주차장 출입 전면 금지 조례안 사실 여부',
    requestCount: 1204,
    trend: 'down',
    trendValue: 2.8,
    updatedAt: '1시간 전'
  },
  {
    id: 'pop-5',
    rank: 5,
    title: '최근 발생한 은행권 해킹 이슈와 개인정보 유출 실태',
    requestCount: 950,
    trend: 'up',
    trendValue: 1.5,
    updatedAt: '2시간 전'
  }
];

export const mockCommunityPosts: CommunityPost[] = [
  {
    id: 'post-1',
    title: '전기차 화재 관련 보도의 객관성 토론',
    content: `최근 연이어 발생하는 전기차 화재 사고에 대한 언론 보도가 공포심을 조장하고 있다는 의견이 있습니다. 
    팩트에 기반한 객관적인 보도가 이루어지고 있는지 데이터로 살펴봅시다. 
    실제 화재 발생률이 내연기관 차량에 비해 높은지, 아니면 자극적인 보도로 인해 체감상 더 위험하게 느껴지는 것인지에 대한 통계적 접근이 필요합니다.`,
    category: 'Issue',
    author: {
      name: '김철수',
      gender: '남',
      ageGroup: '30대',
    },
    commentCount: 12,
    likeCount: 45,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'post-2',
    title: '수도권 광역버스 증차 계획의 실효성 검증',
    content: `정부에서 발표한 수도권 광역버스 증차 및 노선 확대 계획이 실제 출퇴근 시간 단축에 얼마나 기여할 수 있을지 전문가 의견과 실제 이동 데이터를 기반으로 토론하고자 합니다. 
    증차만으로 해결될 문제인지, 도로 혼잡도 개선이 병행되어야 하는지에 대한 심도 있는 논의가 필요합니다.`,
    category: 'Policy',
    author: {
      name: '이영희',
      gender: '여',
      ageGroup: '40대',
    },
    commentCount: 28,
    likeCount: 82,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'post-3',
    title: '청년 일자리 지원금 정책 홍보물 팩트체크',
    content: `지자체별로 시행 중인 청년 일자리 지원금 혜택에 대한 홍보 자료 중 '최대 혜택'이라는 표현이 자격 요건에 따라 크게 다를 수 있다는 제보를 확인 중입니다. 
    누구나 받을 수 있는 것처럼 광고하지만, 실제로는 소득 기준이나 거주 기간 등 까다로운 조건이 숨겨져 있는 경우가 많습니다.`,
    category: 'FactCheck',
    author: {
      name: '박지민',
      gender: '남',
      ageGroup: '20대',
    },
    commentCount: 5,
    likeCount: 19,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  }
];

export const mockCommunityComments: CommunityComment[] = [
  {
    id: 'comment-1',
    postId: 'post-1',
    author: {
      name: '정민수',
      gender: '남',
      ageGroup: '30대',
    },
    content: '보도 자료를 보면 배터리 제조사만 강조하고 실제 관리 부실에 대한 언급은 적은 것 같아요.',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'comment-2',
    postId: 'post-1',
    author: {
      name: '최소연',
      gender: '여',
      ageGroup: '20대',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=So'
    },
    content: '소방청 통계를 찾아보니 내연기관 화재 건수가 압도적으로 많던데, 전기차만 이슈가 되는 경향이 있네요.',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  }
];
