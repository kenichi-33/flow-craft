#!/usr/bin/env python3
import json

first_names = ['太郎', '一郎', '次郎', '三郎', '健太', '大輔', '翔太', '拓也', '雄介', '直樹',
  '花子', '美咲', '由美子', '恵子', '洋子', '真由美', '久美子', '裕子', '智子', '幸子']
last_names = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水']
departments = ['/Company/営業部', '/Company/営業部/営業第一課', '/Company/営業部/営業第二課',
  '/Company/経理部', '/Company/IT部', '/Company/IT部/システム課']
roles_sets = [
  ['wf_user'],
  ['wf_user', 'wf_approver'],
  ['wf_user', 'wf_approver', 'wf_manager'],
]

dept_managers = {
  '/Company/営業部': 'tanaka',
  '/Company/営業部/営業第一課': 'user010',
  '/Company/営業部/営業第二課': 'user020',
  '/Company/経理部': 'user030',
  '/Company/IT部': 'user040',
  '/Company/IT部/システム課': 'admin',
}

users = []
for i in range(1, 101):
    last_name = last_names[i % len(last_names)]
    first_name = first_names[i % len(first_names)]
    dept = departments[i % len(departments)]
    role_set = roles_sets[i % len(roles_sets)]
    username = f'user{str(i).zfill(3)}'
    position = '課長' if 'wf_manager' in role_set else ('主任' if 'wf_approver' in role_set else '一般')
    manager = dept_managers.get(dept, 'admin')
    
    users.append({
        'username': username,
        'enabled': True,
        'email': f'{username}@example.com',
        'firstName': first_name,
        'lastName': last_name,
        'emailVerified': True,
        'attributes': {
            'employeeId': [f'EMP{str(100 + i).zfill(4)}'],
            'displayName': [f'{last_name} {first_name}'],
            'position': [position],
            'managerId': [manager]
        },
        'credentials': [{'type': 'password', 'value': 'password', 'temporary': False}],
        'realmRoles': role_set,
        'groups': [dept]
    })

# 既存のrealmファイルを読み込み
with open('keycloak/workflow-realm.json', 'r', encoding='utf-8') as f:
    realm = json.load(f)

# 既存ユーザーにテストユーザーを追加
realm['users'].extend(users)

# ファイルに書き戻し
with open('keycloak/workflow-realm.json', 'w', encoding='utf-8') as f:
    json.dump(realm, f, ensure_ascii=False, indent=4)

print(f"Added {len(users)} test users to keycloak/workflow-realm.json")
print(f"Total users: {len(realm['users'])}")
