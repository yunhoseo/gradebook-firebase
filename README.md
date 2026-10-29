# 공유 성적 관리

사이트: https://tjdwj-7a047.web.app
프로젝트: tjdwj-7a047
관리자: yunho.seo@kyonggi.ac.kr

## 사용
1. 일반 브라우저에서 사이트를 열고 Google 계정으로 로그인합니다.
2. 관리자는 상단 접근 관리에서 교수·조교 Google 이메일을 등록합니다. 등록된 사람은 모든 과목을 조회·수정·다운로드합니다. 학생은 로그인 대상이 아닙니다.
3. 과목을 추가하고 학생 명단을 가져옵니다. 엑셀의 역할 열이 필수이며, 앞뒤 공백을 제외한 값이 '학생'인 행만 등록됩니다.
4. 시험 설정에서 대문항·소문항과 배점을 지정하고 점수를 입력합니다. 빈칸과 0점은 구분됩니다.
   문항별 점수는 성적 입력 화면의 '점수 엑셀 가져오기'로 한 번에 넣을 수 있습니다. 첫 행 열 제목(1번, 11-1번, '1번 (2점)' 등)으로 문항을, 학번 열로 학생을 찾습니다. 전체 성적 다운로드 파일에 점수를 채워 그대로 올려도 됩니다. 빈칸은 기존 점수를 유지하고, 명단에 없는 학번·중복 학번·배점 초과가 있으면 아무것도 반영하지 않습니다.
5. 과목 삭제는 현재 과목 옆 버튼에서 과목 이름을 정확히 입력해 확인합니다. 학생·시험·점수가 함께 삭제되며 다른 과목은 유지됩니다. 마지막 과목 삭제 후에는 빈 화면에서 새 과목을 추가할 수 있습니다.
6. 상단에 '클라우드에 저장됨'이 표시된 후 창을 닫습니다. 전체 성적 다운로드로 과목별 엑셀을 내려받습니다.

## 저장 및 동시 작업
- Firestore가 저장소이며, 기존 단일 HTML 파일의 로컬 데이터는 자동 이전되지 않습니다.
- 다른 사용자의 변경은 실시간 수신합니다. 입력이나 설정 창을 사용하는 동안은 화면 갱신을 미룹니다.
- 공유 성적부 전체에 버전 번호를 적용합니다. 다른 사용자가 먼저 저장하면 오래된 버전의 저장을 거부합니다. 화면 안내에 따라 JSON 백업과 엑셀을 내려받고 최신 내용을 불러온 뒤 수정 내용을 다시 반영합니다. 자동 병합은 제공하지 않습니다.
- 전체 공유 성적부의 JSON 크기는 750KB로 제한됩니다. 한도 초과 시 저장을 멈추고 백업 안내를 표시합니다.
- 관리자 권한은 Firestore 규칙에서 고정됩니다. 일반 교수·조교는 회원 권한을 바꿀 수 없습니다.
- 현재 기본 데이터베이스 위치는 nam5입니다. Standard 무료 할당량을 사용하는 데이터베이스입니다. Analytics, Storage, Functions, 유료 플랜 업그레이드는 설정하지 않았습니다.

## 구현과 검증
- Firebase Authentication Google 로그인, Firestore 거래 기반 버전 검사, Hosting.
- 모델·동시 저장 검사 16개 및 Firestore 보안 규칙 검사 5개 통과.
- 로컬 에뮬레이터 UI에서 학생 추가, 점수 입력(17점/0점), 서버 저장, 새로고침 후 유지 및 접근 관리 화면 확인.
- 운영 사이트 HTTP 200, Google 공급자 enabled=true, 허용 도메인과 미인증 Firestore 403 확인. 운영 Google 사용자 로그인을 통한 성적 편집은 사용자의 최초 로그인 후 확인 대상.

## 개발
Node.js 22 또는 24 LTS를 사용하세요. Firestore 규칙 테스트에는 Java 21이 필요합니다.

```sh
npm ci
npm test
npm run test:rules
npm run build:emulator
npm run preview
# http://127.0.0.1:8127/?emulator
```

에뮬레이터 빌드는 실제 API 키나 Firebase 프로젝트 인증 없이 가짜 `demo-gradebook` 설정으로 생성됩니다. localhost/127.0.0.1과 `?emulator` 조합에서만 에뮬레이터에 연결하며 테스트 로그인 버튼을 표시합니다. 에뮬레이터 빌드를 운영에 배포하지 마세요. 이 빌드는 운영 호스트에서 Firebase 초기화를 거부합니다.

## Firebase 웹 설정 및 배포
1. `.env.example`을 `.env`로 복사하고, 새로 교체한 Firebase **웹 브라우저 API 키**를 `FIREBASE_API_KEY`에 입력합니다. 나머지 `FIREBASE_*` 항목은 Firebase 콘솔의 웹 앱 설정과 일치해야 합니다.
2. `npm run build`는 `.env`와 현재 프로세스 환경 변수를 읽어 `public/cloud.js`를 생성합니다. 동일 이름의 환경 변수가 `.env`보다 우선하므로 CI에서도 설정할 수 있습니다. 필수 값이 없거나 예제 키가 그대로면 빌드를 거부합니다.
3. 생성된 `public/cloud.js`와 `.env`, `.env.*`는 Git에서 제외합니다. `.env.example`만 추적합니다. 기존에 추적하던 번들은 삭제하고 배포할 때마다 새로 빌드합니다.

```sh
cp .env.example .env
# .env에 새 웹 API 키를 로컬 편집기로 입력 (키를 로그/채팅/커밋에 남기지 않음)
npm run build
npx firebase login
npm run deploy
```

`npm run deploy`는 운영용 빌드를 다시 실행한 뒤 기존 Firestore 규칙/인덱스와 Hosting을 배포합니다. 규칙 변경 없이 Hosting만 배포하려면 `npm run build && npx firebase deploy --only hosting`을 사용하세요. 배포 전 프로젝트가 `tjdwj-7a047`인지 확인하세요.

### API 키 보안 및 교체
- Hosting의 `Referrer-Policy`는 `strict-origin-when-cross-origin`으로 설정합니다. 교차 출처 Firebase API 요청에 사이트 출처(origin)를 전달하여 HTTP referrer로 제한한 웹 API 키를 사용할 수 있게 합니다. `no-referrer`는 이 검증에 필요한 Referer 헤더를 제거하므로 사용하지 않습니다. 경로와 쿼리는 교차 출처 요청에 전달하지 않습니다.
- Firebase 웹 API 키와 웹 앱 설정은 브라우저에서 공개되는 식별 정보입니다. `.env`는 저장소 하드코딩을 방지할 뿐 키를 비밀로 만들지 않습니다. 새 키도 배포 번들과 브라우저 네트워크에서 확인할 수 있습니다. 서비스 계정, 개인 키, 서버 비밀은 절대 넣지 마세요.
- 데이터 접근 보안은 Firebase Authentication 및 Firestore 보안 규칙이 담당합니다. 이 설정 방식은 로그인 권한이나 Firestore 규칙을 변경하지 않습니다. Google Cloud에서 웹사이트 HTTP referrer와 필요한 Firebase API 제한도 검토하세요.
- 노출된 기존 키를 새 키로 교체한 뒤 운영 Google 로그인/토큰 갱신/Firestore 동작을 확인하고, 기존 키를 비활성화 또는 삭제하세요. 과거 Git 커밋의 키는 파일 삭제만으로 없어지지 않으므로 키 교체가 별도로 필요합니다.
- CLI 인증 파일(예: `.firebase-config`)과 로컬 `.env`를 공유하거나 업로드하지 마세요.
