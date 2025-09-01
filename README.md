> 项目根目录，运行
```bash
go run cmd/main.go
```
- 实时+多标签页多开同类用户

# 会话混乱问题

- 所有角色共享同一个localStorage存储空间，导致：
> 管理员登录后覆盖了用户的token 
> 
> 但HTTP请求仍然使用了用户的token 
> 
> 造成认证信息混乱