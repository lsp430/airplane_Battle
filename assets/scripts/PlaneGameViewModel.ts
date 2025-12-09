// PlaneGameViewModel.ts
import { ViewModel, viewModel, observable, command } from '@esengine/mvvm-ui-framework';
import { GameViewModel } from './GameViewModel';

export interface Bullet {
    x: number;
    y: number;
}

export interface Enemy {
    x: number;
    y: number;
    speed: number;
    hp: number;
    hpMax: number;
    hpRatio: number;
}

@viewModel
export class PlaneGameViewModel extends ViewModel {
    public get name() { return 'PlaneGameViewModel'; }

    // ===== 可绑定的状态 =====
    /** 当前得分 */
    @observable
    public score: number = 0;

    /** 是否游戏结束 */
    @observable
    public gameOver: boolean = false;

    /** 玩家飞机 X 坐标（中心坐标系） */
    @observable
    public playerX: number = 0;

    /** 玩家飞机 Y 坐标（中心坐标系） */
    @observable
    public playerY: number = 0;

    /** 游戏区域宽度（由 View 初始化传入） */
    @observable
    public canvasWidth: number = 480;

    /** 游戏区域高度（由 View 初始化传入） */
    @observable
    public canvasHeight: number = 720;

    @observable
    public playerHp: number = 200;

    @observable
    public playerHpMax: number = 200;

    @observable
    public playerHpRatio: number = 1;

    // boss 可以使用
    @observable
    public enemyHp: number = 100;

    @observable
    public enemyHpMax: number = 100;

    @observable
    public enemyHpRatio: number = 1;

    /** 子弹列表（View 用来绘制） */
    public bullets: Bullet[] = [];
    public bulletHurt: number = 25;
    /** 敌机列表（View 用来绘制） */
    public enemies: Enemy[] = [];

    // public gameVM: GameViewModel | null = null;

    public onEnemyKilled?: (x: number, y: number) => void;

    public onMoreEnemy?: () => void;


    // ===== 内部状态，不暴露给绑定 =====
    private _playerSpeed: number = 260;        // 飞机移动速度（像素/秒）
    private _bulletSpeed: number = 480;        // 子弹速度（像素/秒）
    private _enemySpawnTimer: number = 0;      // 敌机生成计时器（秒）
    private _enemySpawnInterval: number = 0.8; // 敌机生成间隔（秒）
    private _playerCooldown: number = 0;       // 射击冷却计时（秒）
    private _cooldownTime: number = 0.2;       // 射击间隔（秒）
    private _moveDir: number = 0;              // -1 左，1 右，0 停止
    private _isRunning: boolean = false;       // 游戏是否在进行中

    // ===== 初始化（由 View 调用） =====
    public init(width: number, height: number) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        // (0,0) 在中心，玩家放在底部偏上一点
        this.playerX = 0;
        this.playerY = -height / 2 + 80;

        this.resetGame();
    }

    // ===== 重置游戏内部状态 =====
    private resetGame() {
        this.score = 0;
        this.gameOver = false;
        this.bullets = [];
        this.enemies = [];
        this._enemySpawnTimer = 0;
        this._enemySpawnInterval = 0.8;
        this._playerCooldown = 0;
        this._moveDir = 0;
        this._isRunning = true;
        this.playerX = 0;
        this.playerHp = 200;
        this.playerHpRatio = 1;
        // if (this.gameVM) {
        //     this.gameVM.score = 0;
        // }
    }

    // ===== command：重新开始游戏（给按钮用） =====
    @command()
    public restart(): void {
        this.resetGame();
    }

    // ===== command：控制移动方向 (-1 左，1 右，0 停止) =====
    @command({ parameterized: true })
    public movePlayer(dir: number): void {
        this._moveDir = dir;
    }

    // ===== command：开火 =====
    @command()
    public shoot(): void {
        if (!this.canShoot()) return;

        const bullet: Bullet = {
            x: this.playerX,
            y: this.playerY + 20, // 从飞机头顶发射
        };
        this.bullets.push(bullet);
        this._playerCooldown = this._cooldownTime;
    }

    public canShoot(): boolean { 
        if (this.gameOver || !this._isRunning) return false;
        if (this._playerCooldown > 0) return false;
        return true;
    }

    // ===== 每帧更新，由 View 调用 =====
    public update(dt: number): void {
        if (!this._isRunning || this.gameOver) return;

        const halfW = this.canvasWidth / 2;
        const halfH = this.canvasHeight / 2;

        // 冷却计时
        if (this._playerCooldown > 0) {
            this._playerCooldown -= dt;
            if (this._playerCooldown < 0) this._playerCooldown = 0;
        }

        // 玩家移动
        if (this._moveDir !== 0) {
            this.playerX += this._moveDir * this._playerSpeed * dt;
            // 限制左右边界
            const margin = 20;
            if (this.playerX < -halfW + margin) this.playerX = -halfW + margin;
            if (this.playerX >  halfW - margin) this.playerX =  halfW - margin;
        }

        // 敌机生成
        this._enemySpawnTimer += dt;
        if (this._enemySpawnTimer >= this._enemySpawnInterval) {
            this._enemySpawnTimer = 0;
            this.spawnEnemy();
            // 随分数略微加快生成速度
            if (this._enemySpawnInterval > 0.35) {
                this._enemySpawnInterval -= 0.01;
            }
        }

        // 子弹更新（向上）
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.y += this._bulletSpeed * dt;
            if (b.y > halfH + 40) {
                this.bullets.splice(i, 1);
            }
        }

        // 敌机更新（向下）
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.y -= e.speed * dt;
            // 超出下边界 → 游戏结束
            if (e.y < -halfH - 40) {
                // this.gameOver = true;
                // this._isRunning = false;
                this.enemies.splice(i, 1);
                return;
            }
        }

        // 碰撞检测
        this.checkCollisions();

        // 难度升级提示
        if (this.score > 0 && this.score%230 == 0 && this.onMoreEnemy) {
            this.onMoreEnemy();
        }
    }

    // 生成敌机（从顶部随机位置出现）
    private spawnEnemy() {
        const halfW = this.canvasWidth / 2;
        const halfH = this.canvasHeight / 2;

        const margin = 40;
        const x = Math.random() * (this.canvasWidth - margin * 2) - (this.canvasWidth / 2 - margin);
        const y = halfH + 30; // 在屏幕上方一点出现

        const hpMax = 50;
        const hp = hpMax;
    
        const speed = 80 + Math.random() * 60 + this.score * 0.3;

        this.enemies.push({ x, y, speed, hp, hpMax, hpRatio: 1 });
        let jjh = 0 + 2;
    }

    private checkCollisions() {
        const halfH = this.canvasHeight / 2;

        // 子弹 vs 敌机
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                if (Math.abs(e.x - b.x) < 54 && Math.abs(e.y - b.y) < 54) {
                    this.bullets.splice(j, 1);

                    e.hp -= this.bulletHurt;
                    e.hp = Math.max(0, e.hp);
                    e.hpRatio = e.hpMax > 0 ? e.hp / e.hpMax : 0;
                    if (e.hp <= 0) {
                        this.enemies.splice(i, 1);
                        this.score += 10;
                        if (this.onEnemyKilled) {
                            this.onEnemyKilled(e.x, e.y);
                        }
                    }
                    break;
                }
            }
        }

        // 敌机 vs 玩家
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (
                Math.abs(e.x - this.playerX) < 55 &&
                Math.abs(e.y - this.playerY) < 65
            ) {
                this.playerHp -= 20;
                this.playerHp = Math.max(0, this.playerHp);
                this.playerHpRatio = this.playerHp/this.playerHpMax;
                if (this.playerHp <= 0) {
                    this.gameOver = true;
                    this._isRunning = false;
                }
                e.hp = 0;
                e.hpRatio = e.hpMax > 0 ? e.hp / e.hpMax : 0;
                this.enemies.splice(i, 1);
                if (this.onEnemyKilled) {
                    this.onEnemyKilled(e.x, e.y);
                }
                break;
            }
        }
    }
}
