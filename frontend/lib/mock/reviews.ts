import { Review } from '../types/review';

export const mockReviews: Record<string, Review> = {
  'mock-1': {
    id: 'mock-1',
    claim: '서울시 대중교통 무제한 이용권, 전 세계 최초 도입 사례다',
    verdict: 'Likely True',
    confidence: 98,
    status: 'completed',
    interpretation: '해당 청구 내용은 독일의 \'D-Ticket\' 등 유사 사례가 존재하나, **도시 단위의 완전 무제한 통합 정기권**으로서의 서울시 모델은 체계와 범위 면에서 독자적인 혁신성을 인정받고 있습니다. 국토교통부와 서울시의 공식 문건에서 \'세계 최초\'라는 표현이 사용되었으며, 외신 매체들도 해당 모델의 정교함을 주요하게 다루고 있습니다.',
    uncertainty: '현재 분석은 2024년 5월까지의 공개 데이터를 기반으로 합니다. 해외 일부 소도시의 유사 사례가 누락되었을 가능성이 있으며, \'최초\'의 정의에 따라 해석이 달라질 수 있습니다.',
    consensusLevel: 'High',
    consensusLabel: '주요 기관 의견 일치',
    distribution: {
      official: 50,
      press: 30,
      social: 20,
    },
    sources: [
      {
        id: 's1',
        name: '서울특별시 보도자료',
        type: 'Official',
        logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmL4ONh9RYxPlcOO3TklUgyk8Tqj_VXyrIBGKfe2sik118NJwb_lJm-89zGCZ9GJILCm22bIRkvvTPZShBMUO9A0H9ZO-YddjYQoPhiLXQswhm9akrT4hJLh_Fq1HheleRBT4ZHysSinvbiJp6pZEBGNy17H21bmRjC9-DHR_x1Wp-Ym8eR0IJ0wjK7L6pWdbQ0JAcc26h13adWfYTPf4jffHTU5sAjnbnuQiqwcqi423b0gJ6jnb9V-ROYyBrQ9A2KDj5E6U7t8jh',
        publishTime: '2시간 전',
        url: '#',
        snippet: '기후동행카드는 세계 대도시 중 최초로 도입되는 무제한 대중교통 정기권으로...',
        reliability: 'High',
        reliabilityLabel: '신뢰도 매우 높음',
      },
      {
        id: 's2',
        name: 'JTBC 뉴스룸',
        type: 'Press',
        logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2ACuR7woRWxOB07ABZ221749YCar2BoYcAVtlNLmox3s8VSCh2DYEQMlSPapIsg9Zuir_S_FvxaeBjXB4lYTiGCQMaRsV6EiU-lNsnN11nly_ii26WxSitLiEKXq8ol_I_Y_nRxiDbXBqvkbQ6Kff7FIXPYToB36PYoy--EJOf3Jnv8YsPuqSx8P6Gm3hVK9MzYIojwTK-1g1qggh_OfjDouyJgfFvFUhKE6gkaA7rMPCdk9glsPnONLbemWQc7U1PH6wNSLVDA8A',
        publishTime: '5시간 전',
        url: '#',
        snippet: '세계 최초 수식어에 대한 전문가 의견 분분하나, 운영 체계 측면에서는 독보적...',
        reliability: 'High',
        reliabilityLabel: '팩트체크 완료',
      },
    ],
  },
};
