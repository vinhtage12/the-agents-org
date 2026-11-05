# Warehouses (Kho)

Tương tự cơ chế của "Kho ticket", làm thêm:

- Kho repo
- Kho agents
- Kho skills
- Kho rules

## Chuẩn bị

Tạo Menu Kho, bên trong sẽ có 5 nav tab: 

- Ticket: Move cái khi ticket vào đây
- Repository
- Agent
- Skill
- Rule

## Mô tả các kho còn lại:

Tất cả các kho còn lại này sẽ tuân thủ 1 Layout chung, trang chính là bảng show danh sách, mỗi row sẽ có cột action có icon button edit, delete (disable khi có ít nhất 1 project hoặc ticket hoặc sprint (tùy trường hợp) ref đến repo này). Nút edit sẽ mở popup show chi tiết của item đó kèm thống kê cái gì và bao nhiêu thứ đang ref đến nó (có uitils navigate nhanh đến cái đó) 

### Kho Repository

CRUD các repository. Mỗi repository sẽ bao gồm các trường thông tin:

- Tên repo
- Absolute path
- Danh sách các môi trường mà repo này có. Danh sách này tôi sẽ setup, có CRUD. Mỗi môi trường sẽ có các trường thông tin như sau:
  - Tên môi trường
  - File .env
  - Nhánh. Mỗi Nhánh này sẽ phải đánh dấu 1 trong 3 trường hợp: Nhánh được checkout khi bắt đầu làm feature, Nhánh được PR vào sau khi hoàn thành feature và không là gì cả 
- Description
- Created At
- Updated At 

Project sẽ ref đến kho repository. Khi tạo và chỉnh sửa project, sẽ có field sử dụng TmnAutocomplete sẽ lấy danh sách các repo hiện có để chọn, project sẽ chỉ lưu id của repo đó

### Kho Agents

CRUD agents, Mỗi Agent sẽ bao gồm các trường thông tin:

- Tên
- Role: BA, DEV, QC, File Processor
- Provider
- Model
- Effort
- Description
- Allowed Tool
- Skill set (ref 1..n Kho Skills)
- Rule set (ref 1..n Kho Rules)
- Assets (cho định hướng visualize các agent):
  - Avatar
  - Sprites

Project và ticket sẽ ref đến Agent qua cơ chế select như Repository. Tùy vào field đó cần role gì thì lọc agent theo role đó thông qua apiParams của Autocomplete

### Kho Rules

Rules cho các agents tuân theo

Agents và ticket sẽ ref đến rules theo quan hệ Agents|tickets 1..n rules

### Kho Skills 

Skills cho agents sử dụng

Agents và ticket sẽ ref đến rules theo quan hệ Agents|tickets 1..n rules