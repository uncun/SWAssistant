class manuUpgrade {
    constructor() {
        this.upgradeAllText = 'Ulepsz wszystkie';
        this.stopText = 'STOP';
        this.hasStarted = false;
        this.responseTimer = null;
        this.observer = null;

        this.insertButton(1);

        $("body").on("click", 'button[data-option="manu_upgrade_all"]', () => {
            this.controller();
        });
    }

    insertButton(attempt) {
        if ($('button[data-option="manu_upgrade_all"]').length) return;
        var container = $('#page_game_manus .pull-right');
        if (!container.length) {
            if (attempt < 20) setTimeout(() => this.insertButton(attempt + 1), 50);
            return;
        }
        container.prepend(`<button class="newBtn option" data-option="manu_upgrade_all" style="margin-right:8px;">${this.upgradeAllText}</button>`);
    }

    controller() {
        if (this.hasStarted) {
            this.stopUpgrading();
        } else {
            this.startUpgrading();
        }
    }

    startUpgrading() {
        if (!$('#manu_view .scroll_upgrade').length) return;
        this.hasStarted = true;
        this.switchButtonText();
        this.observeRefresh();
        this.upgradeWave();
    }

    stopUpgrading() {
        this.hasStarted = false;
        clearTimeout(this.responseTimer);
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.switchButtonText();
    }

    upgradeWave() {
        if (!this.hasStarted) return;
        if (!$('#manu_view').is(':visible')) {
            this.stopUpgrading();
            return;
        }

        var ids = $('#manu_view .scroll_upgrade').map(function () {
            return $(this).data('scroll');
        }).get();
        if (!ids.length) {
            this.stopUpgrading();
            return;
        }

        ids.forEach(function (id) {
            GAME.emitOrder({ a: 209, type: 2, scroll: id }, true);
        });
        // fallback, gdyby serwer nie odswiezyl panelu
        this.responseTimer = setTimeout(() => this.upgradeWave(), 300);
    }

    observeRefresh() {
        var target = document.getElementById('manu_view');
        if (!target) return;

        this.observer = new MutationObserver(() => {
            if (!this.hasStarted) return;
            clearTimeout(this.responseTimer);
            this.responseTimer = setTimeout(() => this.upgradeWave(), 12);
        });
        this.observer.observe(target, { childList: true });
    }

    switchButtonText() {
        $('button[data-option="manu_upgrade_all"]').html(this.hasStarted ? this.stopText : this.upgradeAllText);
    }
}

new manuUpgrade();
