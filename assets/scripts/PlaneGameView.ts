// PlaneGameView.ts
import { _decorator, Component, Node, Label, Prefab, instantiate, Vec3, UITransform, Input, input, EventKeyboard, KeyCode, UIOpacity, tween, v3, Animation, AudioSource, AudioClip, ProgressBar } from 'cc';
import { PlaneGameViewModel } from './PlaneGameViewModel';
import { DataBinding, BindingType, BindingMode } from '@esengine/mvvm-ui-framework';
import { GameViewModel } from './GameViewModel';

const { ccclass, property } = _decorator;

@ccclass('PlaneGameView')
export class PlaneGameView extends Component {

    @property(Node)
    playerNode: Node = null!;

    @property(ProgressBar)
    playerBlood: ProgressBar = null!;

    @property(Prefab)
    bulletPrefab: Prefab = null!;

    @property(Prefab)
    enemyPrefab: Prefab = null!;

    @property(Label)
    scoreLabel: Label = null!;

    @property(Node)
    gameOverPanel: Node = null!;

    @property(Prefab)
    resultToast: Prefab = null!;

    @property(Prefab)
    enemyTips: Prefab = null!;

    @property(Node)
    playNode: Node = null!;

    // ================== 音效相关 ==================
    @property(AudioSource)
    audioSource: AudioSource = null!;

    /** 射击音效 */
    @property(AudioClip)
    sfxShoot: AudioClip = null!;

    /** 击中敌机 / 爆炸音效 */
    @property(AudioClip)
    sfxExplosion: AudioClip = null!;

    /** 击中敌机 / 爆炸音效 */
    @property(AudioClip)
    enemyComing: AudioClip = null!;

    /** 游戏结束音效 */
    @property(AudioClip)
    sfxGameOver: AudioClip = null!;

    /** 点击按钮音效（重新开始） */
    @property(AudioClip)
    sfxClick: AudioClip = null!;

    /** 背景音乐 */
    @property(AudioClip)
    bgmClip: AudioClip = null!;

    @property([AudioClip])
    scoreMusicList: AudioClip[] = [];

    @property({type: PlaneGameViewModel})
    vm: PlaneGameViewModel = null!;

    @property(Prefab)
    coinEffectPrefab: Prefab = null!;

    private dataBinding = DataBinding.getInstance();

    private bulletNodes: Node[] = [];
    private enemyNodes: Node[] = [];
    private lastShootTime: number = 0;
    private shootInterval: number = 0.2; // 射击间隔（秒）
    private _lastGameOver: boolean;
    private lastScore: number = 0;
    private lastMusicScore: number = -1;
    private lastTipsScore: number = -1;

    // public gameVM: GameViewModel = GameViewModel.inst;

    onLoad() {
        // 1. 创建 VM
        this.vm = new PlaneGameViewModel();
        // this.vm.gameVM = this.gameVM;   // 注入

        // 2. 获取当前 UI 区域大小，作为“游戏区域”
        const ui = this.node.getComponent(UITransform);
        const width = ui ? ui.width : 480;
        const height = ui ? ui.height : 720;
        this.vm.init(width, height);

        // 3. 绑定 score -> Label.string
        if (this.scoreLabel) {
            this.dataBinding.bind(this.vm, this.scoreLabel as any, {
                type: BindingType.ONE_WAY,
                mode: BindingMode.REPLACE,
                source: 'score',
                target: 'string', 
                format: '得分：{0}'
            });
        }

        // 4. 绑定 gameOver -> gameOverPanel.active
        this.dataBinding.bind(this.vm, this.gameOverPanel as any, {
            type: BindingType.ONE_WAY,
            mode: BindingMode.REPLACE,
            source: 'gameOver',
            target: 'active',
        });

        this.dataBinding.bind(this.vm, this.playerBlood as any, {
            type: BindingType.ONE_WAY,
            mode: BindingMode.REPLACE,
            source: 'playerHpRatio', 
            target: 'progress',
            // converter: 'updateSlider',
        });

        // 5. 键盘输入监听
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);

        this.vm.onEnemyKilled = (x: number, y: number) => {
            this.playCoinEffect(x, y);
        };

        this.vm.onMoreEnemy = () => {
            if (this.vm.score != this.lastTipsScore) {
                this.playSfx(this.enemyComing);
                this.showEnemyTips();
                this.lastTipsScore = this.vm.score;
            }
        };

        this.playBGM();
    }

    private playSfx(clip?: AudioClip, scale?: number) {
        if (!this.audioSource || !clip) return;
        if (scale) {
            this.audioSource.volume = scale;
        }
        this.audioSource.playOneShot(clip);
    }

    private playCoinEffect(x: number, y: number) {
        if (!this.coinEffectPrefab) {
            console.warn('coinEffectPrefab 未设置');
            return;
        }

        const node = instantiate(this.coinEffectPrefab);
        this.playNode.addChild(node);

        node.setPosition(new Vec3(x, y, 0));

        const anim = node.getComponent(Animation);
        if (anim) {
            anim.once(Animation.EventType.FINISHED, () => {
                node.destroy();
            }, this);

            anim.play('animation0');
        } else {
            this.scheduleOnce(() => {
                node.destroy();
            }, 0.5);
        }
    }

    playBGM() {
        if (!this.audioSource || !this.bgmClip) return;
        this.audioSource.loop = true;
        this.audioSource.clip = this.bgmClip;
        this.audioSource.play();
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    private onKeyDown(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.vm.movePlayer(-1);
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.vm.movePlayer(1);
                break;
            case KeyCode.SPACE:
                if (this.vm.canShoot()) {
                    this.playSfx(this.sfxShoot);
                    this.vm.shoot();
                }
                break;
        }
    }

    private onKeyUp(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.vm.movePlayer(0);
                break;
        }
    }

    // 每帧更新
    update(dt: number) {
        this.vm.update(dt);

        // 检测 gameOver 由 false -> true 的瞬间，触发结算 Toast
        if (!this._lastGameOver && this.vm.gameOver) {
            this.playSfx(this.sfxGameOver);
            this.showResultToast();
        }
        this._lastGameOver = this.vm.gameOver;

        // 玩家位置
        if (this.playerNode) {
            this.playerNode.setPosition(
                new Vec3(this.vm.playerX, this.vm.playerY, 0),
            );
        }

        if (this.playerBlood) {
            // this.playerBlood.getComponent(ProgressBar).progress = 0.2;
        }

        // 同步子弹/敌机节点
        this.syncBulletNodes();
        this.syncEnemyNodes();

        // 控制射击频率
        this.lastShootTime += dt;
        if (this.lastShootTime >= this.shootInterval) {
            if (this.vm.canShoot()) {
                this.playSfx(this.sfxShoot);
                this.vm.shoot();
                this.lastShootTime = 0;
            }
        }

        if (this.vm.score > this.lastScore) {
            this.playSfx(this.sfxExplosion);
            this.lastScore = this.vm.score;
        }

        if (this.vm.score > 0 && this.vm.score % 200 == 0 && this.vm.score != this.lastMusicScore) {
            let index = Math.floor(this.vm.score / 200) - 1;
            if (index >= this.scoreMusicList.length) {
                index = this.scoreMusicList.length - 1;
            }
            const clip = this.scoreMusicList[index];
            if (clip) {
                this.playSfx(clip);
            }

            // 记录这次已经触发过
            this.lastMusicScore = this.vm.score;
        }
    }

    private syncBulletNodes() {
        // 调整数量
        while (this.bulletNodes.length < this.vm.bullets.length) {
            if (this.bulletPrefab) {
                const node = instantiate(this.bulletPrefab);
                this.playNode.addChild(node);
                this.bulletNodes.push(node);
            }
        }
        while (this.bulletNodes.length > this.vm.bullets.length) {
            const node = this.bulletNodes.pop()!;
            node.destroy();
        }

        // 更新位置
        for (let i = 0; i < this.vm.bullets.length; i++) {
            const b = this.vm.bullets[i];
            const node = this.bulletNodes[i];
            node.setPosition(new Vec3(b.x, b.y, 0));
        }
    }

    private syncEnemyNodes() {
        while (this.enemyNodes.length < this.vm.enemies.length) {
            if (this.enemyPrefab) {
                const node = instantiate(this.enemyPrefab);
                this.playNode.addChild(node);
                this.enemyNodes.push(node);
            }
        }
        while (this.enemyNodes.length > this.vm.enemies.length) {
            const node = this.enemyNodes.pop()!;
            node.destroy();
        }

        for (let i = 0; i < this.vm.enemies.length; i++) {
            const e = this.vm.enemies[i];
            const node = this.enemyNodes[i];
            node.setPosition(new Vec3(e.x, e.y, 0));
        }
    }

    public resetGame() { 
        this.lastShootTime = 0;
        this.shootInterval = 0.2; // 射击间隔（秒）
        this._lastGameOver = false;
        this.lastScore = 0;
        this.lastMusicScore = -1;
        this.lastTipsScore = -1;
    }

    public restart(): void {
        this.resetGame();
    }

    // 给按钮挂的事件：重新开始
    public onClickRestart() {
        this.playSfx(this.sfxClick);
        this.restart();
        this.vm.restart();
    }

    private showEnemyTips() {
        this.playGameTips(this.enemyTips);
    }

    private playGameTips(prefabNode: Prefab) {
        if (!prefabNode) {
            console.warn('[PlaneGameView] resultToast 未设置，无法显示结算提示条');
            return;
        }

        const ui = this.node.getComponent(UITransform);
        const width = ui ? ui.width : 480;
        const height = ui ? ui.height : 720;

        const toastNode = instantiate(prefabNode);
        this.node.addChild(toastNode);

        const startPos = new Vec3(0, height * 0.1, 0);
        const endPos = new Vec3(0, height * 0.4, 0);
        toastNode.setPosition(startPos);

        tween(toastNode)
            .delay(1.0)
            .by(2.0, { position: endPos })
            .call(() => {
                toastNode.removeFromParent()
                toastNode.destroy();
            })
            .start();
        tween(toastNode.getComponent(UIOpacity))
            .delay(1.0)
            .to(0.01, { opacity: 255 })
            .to(2.0, { opacity: 125 })
            .start();

        return toastNode;
    }

    private showResultToast() {
        let toastNode = this.playGameTips(this.resultToast);
        const labelNode = toastNode.getChildByName("curScore");
        const label = labelNode.getComponent(Label)
        if (label) {
            label.string = `游戏结束，得分：${this.vm.score}`;
        }
    }

}
