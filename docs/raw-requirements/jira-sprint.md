# Jira sprint

## Chuẩn bị

### Phân biệt một project là nhận đặc tả local, jira hoặc hybrid

Thêm 1 field dạng select (UI sử dụng TmnSelect) khi tạo và chỉnh sửa thông tin của một project với 3 options:

- Local: sẽ nhận spec từ local, đọc 1 file từ local theo đường path cố định hoặc spec trực tiếp trong ticket
- Jira: Nhận ticket bằng cách sync ticket từ jira như giải pháp hiện tại
- Hybrid: nhận cả 2, vừa nhận spec từ local và từ jira thông qua sync

Đối với nhận spec từ local, khi chọn spec từ local hoặc hybrid thì show 1 field để người dùng điền đường dẫn chứa các spec và chỉ đọc những file .md. Nếu spec trên ticket thì sẽ lưu vào database. 

Thêm chức năng tự tạo ticket. Những ticket tự tạo sẽ có cách gen key riêng để đảm bảo không trùng với tiket từ jira nhưng vẫn đảm bảo có key prefix của project

## Tích hợp sprint

Tương tự sprint của jira

Có bộ lọc theo sprint trên board của mỗi project

Có thể tự tạo sprint, bất kể project thuộc dạng tạo ticket nào
