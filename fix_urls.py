import os

def replace_in_files():
    count = 0
    for root, dirs, files in os.walk('c:/Users/afiqr/OneDrive/Desktop/Project/fy-intech-crm/src'):
        for file in files:
            if file.endswith('.js') or file.endswith('.jsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content.replace(
                    'http://${window.location.hostname}:8000',
                    '${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}'
                )
                
                # Also catch the ones I might have messed up before
                new_content = new_content.replace(
                    "${import.meta.env.VITE_API_URL || 'http://' + window.location.hostname + ':8000'}",
                    '${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}'
                )

                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Updated {path}')
                    count += 1
    print(f'Total files updated: {count}')

if __name__ == '__main__':
    replace_in_files()
