/* ==========================================================================
   freelanxur -- Main JavaScript
   IIFE: API fetching, DOM rendering, scroll animations, interactive features
   ========================================================================== */

(function () {
    'use strict';

    var DEFAULT_SECTION_CONFIG = [
        { key: 'hero', enabled: true },
        { key: 'metrics', enabled: true },
        { key: 'services', enabled: true },
        { key: 'projects', enabled: true },
        { key: 'about', enabled: true },
        { key: 'experience', enabled: true },
        { key: 'skills', enabled: true },
        { key: 'contact', enabled: true }
    ];

    function getSectionConfig() {
        var el = document.getElementById('sections-config');
        if (!el) {
            return DEFAULT_SECTION_CONFIG;
        }
        return JSON.parse(el.textContent);
    }

    function getSectionFlags(sectionConfig) {
        sectionConfig = sectionConfig || getSectionConfig();
        var flags = {};
        sectionConfig.forEach(function (section) {
            flags[section.key] = section.enabled;
        });
        return flags;
    }

    function getFirstSectionAfterHero(sectionConfig) {
        sectionConfig = sectionConfig || getSectionConfig();
        for (var i = 0; i < sectionConfig.length; i++) {
            var section = sectionConfig[i];
            if (section.key !== 'hero' && section.enabled) {
                return section.key;
            }
        }
        return null;
    }

    function fetchSectionData(sectionFlags) {
        return Promise.all([
            fetchJSON('/api/profile'),
            sectionFlags.metrics ? fetchJSON('/api/metrics') : Promise.resolve(null),
            sectionFlags.about ? fetchJSON('/api/about') : Promise.resolve(null),
            sectionFlags.skills ? fetchJSON('/api/skills') : Promise.resolve(null),
            sectionFlags.services ? fetchJSON('/api/services') : Promise.resolve(null),
            sectionFlags.projects ? fetchJSON('/api/projects') : Promise.resolve(null),
            sectionFlags.experience ? fetchJSON('/api/experience') : Promise.resolve(null),
            sectionFlags.contact ? fetchJSON('/api/contact') : Promise.resolve(null)
        ]);
    }

    /* ----------------------------------------------------------------------
       1. THEME
       ---------------------------------------------------------------------- */

    const THEME_KEY = 'theme';
    const DARK = 'dark';
    const LIGHT = 'light';

    function getTheme() {
        return localStorage.getItem(THEME_KEY) || DARK;
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);

        // Keep top-right Psyduck toggle state in sync.
        const topToggle = document.getElementById('theme-toggle');
        if (topToggle) {
            topToggle.setAttribute('aria-pressed', String(theme === DARK));
        }
    }

    function setupThemeToggle() {
        applyTheme(getTheme());

        var btn = document.getElementById('theme-toggle');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var next = getTheme() === DARK ? LIGHT : DARK;
            var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!document.startViewTransition || reduceMotion) {
                applyTheme(next);
                return;
            }

            // Reveal the new theme as a circle growing out of the toggle button
            var rect = btn.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

            document.startViewTransition(function () {
                applyTheme(next);
            }).ready.then(function () {
                document.documentElement.animate(
                    {
                        clipPath: [
                            'circle(0px at ' + x + 'px ' + y + 'px)',
                            'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'
                        ]
                    },
                    {
                        duration: 650,
                        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
                        pseudoElement: '::view-transition-new(root)'
                    }
                );
            });
        });
    }

    function runPageLoader(callback) {
        var loader = document.getElementById('page-loader');
        if (!loader) { callback(); return; }

        // Skip on repeat visits in same session
        if (sessionStorage.getItem('loaderShown')) {
            loader.remove();
            callback();
            return;
        }

        // Skip for reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            loader.remove();
            sessionStorage.setItem('loaderShown', '1');
            callback();
            return;
        }

        sessionStorage.setItem('loaderShown', '1');

        // Hide navbar off-screen so it can slide in later
        var navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.transform = 'translateY(calc(-100% - 24px))';
        }

        // Measure the natural text width so the transition has an exact target
        var loaderText = loader.querySelector('.loader-text');
        var textWidth = 0;
        if (loaderText) {
            loaderText.style.width = 'auto';
            loaderText.style.position = 'absolute';
            loaderText.style.visibility = 'hidden';
            textWidth = Math.ceil(loaderText.scrollWidth) + 8;
            loaderText.style.width = '0';
            loaderText.style.position = '';
            loaderText.style.visibility = '';
        }

        var loaderBrand = loader.querySelector('.loader-brand');

        // Logo fades in (0-1000ms via CSS)
        // Text expands via transition (600-1700ms)
        // Dwell (1700-1850ms)
        // Panels split, brand stays (1850ms)
        // Brand morphs to hero position (2650ms)
        // Handoff to hero title (3050ms)
        setTimeout(function () {
            if (loaderText) {
                loaderText.style.width = textWidth + 'px';
            }
            if (loaderBrand) {
                loaderBrand.style.gap = '12px';
            }
        }, 600);

        // Remove overflow clip after text transition finishes
        setTimeout(function () {
            if (loaderText) {
                loaderText.style.overflow = 'visible';
            }
        }, 1750);

        // Fade out loader, animate brand into hero position
        setTimeout(function () {
            if (!getSectionFlags().hero) {
                callback();
                loader.classList.add('fade-out');
                setTimeout(function () {
                    loader.remove();
                }, 600);
                return;
            }

            // Snapshot brand position
            var brandRect = loaderBrand.getBoundingClientRect();

            // Lift brand out of loader so it stays visible during fade
            loaderBrand.style.position = 'fixed';
            loaderBrand.style.left = brandRect.left + 'px';
            loaderBrand.style.top = brandRect.top + 'px';
            loaderBrand.style.zIndex = '100000';
            loaderBrand.style.margin = '0';
            document.body.appendChild(loaderBrand);

            // Render hero content behind the loader
            callback();

            // Fade out the loader background
            loader.classList.add('fade-out');

            // Double-rAF: wait for hero to render + paint before measuring
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    var target = document.querySelector('.hero-title-morph-target');
                    if (!target) return;

                    // Align the floating brand to the real title by measuring the
                    // logo elements directly. The logo is the shared visual anchor,
                    // so matching its top-left lands both logo and text pixel-perfect
                    // regardless of container centering, text width or scrollbars.
                    var brandLogo = loaderBrand.querySelector('.loader-logo');
                    var targetLogo = target.querySelector('.logo-img');
                    if (!brandLogo || !targetLogo) return;

                    var brandLogoRect = brandLogo.getBoundingClientRect();
                    var targetLogoRect = targetLogo.getBoundingClientRect();

                    // Compute movement via transform (GPU-composited)
                    var dx = targetLogoRect.left - brandLogoRect.left;
                    var dy = targetLogoRect.top - brandLogoRect.top;

                    loaderBrand.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
                    loaderBrand.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

                    // After animation completes, reveal the real title and drop the
                    // floating clone in the same frame so there is no flicker/jump.
                    var handoffDone = false;
                    function doHandoff() {
                        if (handoffDone) return;
                        handoffDone = true;

                        target.style.visibility = '';
                        loaderBrand.remove();
                        loader.remove();
                    }

                    loaderBrand.addEventListener('transitionend', function handler(e) {
                        if (e.propertyName !== 'transform') return;
                        loaderBrand.removeEventListener('transitionend', handler);
                        doHandoff();
                    });

                    // Safety fallback if transitionend doesn't fire
                    setTimeout(doHandoff, 800);
                });
            });
        }, 1850);

        // Slide navbar in from top (after loader fades + brand starts moving)
        setTimeout(function () {
            if (navbar) {
                navbar.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                navbar.style.transform = '';
                // Clean up inline styles after animation completes
                setTimeout(function () {
                    navbar.style.transition = '';
                }, 550);
            }
        }, 2450);
    }

    /* ----------------------------------------------------------------------
       2. NAVBAR -- Hamburger, Mobile Menu, Active Highlighting
       ---------------------------------------------------------------------- */

    function setupNavbar() {
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');

        if (hamburger && mobileMenu) {
            hamburger.addEventListener('click', function () {
                hamburger.classList.toggle('active');
                mobileMenu.classList.toggle('active');
                hamburger.setAttribute(
                    'aria-expanded',
                    hamburger.classList.contains('active').toString()
                );
            });

            // Close mobile menu when a link is clicked
            mobileMenu.querySelectorAll('.mobile-link').forEach(function (link) {
                link.addEventListener('click', function () {
                    hamburger.classList.remove('active');
                    mobileMenu.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                });
            });
        }

        // Scroll indicator click
        var scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', function () {
                var sectionConfig = getSectionConfig();
                var sectionFlags = getSectionFlags(sectionConfig);
                var targetId = getFirstSectionAfterHero(sectionConfig);
                if (!targetId) return;
                var targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Navbar + scroll progress + blur intensification
        var navbar = document.getElementById('navbar');
        var scrollProgress = document.getElementById('scroll-progress');
        var heroSection = document.querySelector('.hero-section');
        var heroHeight = heroSection ? heroSection.offsetHeight : 600;
        if (heroSection) {
            window.addEventListener('resize', function () {
                heroHeight = heroSection.offsetHeight;
            }, { passive: true });
        }

        if (navbar) {
            window.addEventListener('scroll', function () {
                var scrollY = window.scrollY;

                // Scrolled class
                if (scrollY > 100) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }

                // Blur intensification (20px -> 40px over hero height)
                var blurProgress = Math.min(scrollY / heroHeight, 1);
                var blur = 20 + (blurProgress * 20);
                navbar.style.setProperty('--navbar-blur', blur + 'px');

                // Scroll progress bar
                if (scrollProgress) {
                    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                    var progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
                    scrollProgress.style.width = progress + '%';
                }
            }, { passive: true });
        }
    }

    function setupHeroParallax() {
        var heroContent = document.querySelector('.hero-section .section-content');
        var heroSection = document.querySelector('.hero-section');
        var scrollIndicator = document.querySelector('.hero-section .scroll-indicator');
        if (!heroContent || !heroSection) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        heroContent.classList.add('hero-parallax');

        function updateHeroScroll() {
            var scrollY = window.scrollY;
            var heroHeight = heroSection.offsetHeight;
            var progress = Math.min(scrollY / heroHeight, 1);

            var translateY = scrollY * 0.2;
            var translateZ = -progress * 700;
            var scale = 1 - progress * 0.45;
            var opacity = 1 - progress * 0.9;

            heroContent.style.transform =
                'translate3d(0, ' + translateY + 'px, ' + translateZ + 'px) scale(' + scale + ')';
            heroContent.style.opacity = opacity;

            if (scrollIndicator) {
                scrollIndicator.style.opacity = String(Math.max(0, 1 - progress * 2.5));
            }
        }

        window.addEventListener('scroll', updateHeroScroll, { passive: true });
        updateHeroScroll();
    }

    function setupNavHighlighting() {
        var sections = document.querySelectorAll('.section[id]');
        var navLinks = document.querySelectorAll('.nav-link');
        var navLinksWrap = document.querySelector('.nav-links');

        if (!sections.length || !navLinks.length || !navLinksWrap) return;

        var indicator = navLinksWrap.querySelector('.nav-links-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'nav-links-indicator';
            navLinksWrap.appendChild(indicator);
        }

        var sectionConfig = getSectionConfig();
        var sectionFlags = getSectionFlags(sectionConfig);
        var activeLink = null;
        var contactHref = sectionFlags.contact ? '#contact' : null;

        function moveIndicator(link) {
            if (!link) return;
            var wrapRect = navLinksWrap.getBoundingClientRect();
            var linkRect = link.getBoundingClientRect();
            indicator.style.width = linkRect.width + 'px';
            indicator.style.transform = 'translateX(' + (linkRect.left - wrapRect.left) + 'px)';
            indicator.classList.add('visible');
        }

        function setActiveLinkByHref(targetHref) {
            var nextActive = null;
            navLinks.forEach(function (link) {
                var href = link.getAttribute('href');
                var isActive = targetHref && href === targetHref;
                link.classList.toggle('active', !!isActive);
                if (isActive) {
                    nextActive = link;
                }
            });

            activeLink = nextActive;
            if (activeLink) {
                moveIndicator(activeLink);
            } else {
                indicator.classList.remove('visible');
            }
        }

        // Map section IDs to the nav link href that should be highlighted
        var sectionToNav = {
            hero: null,
            metrics: null,
            services: sectionFlags.services ? '#services' : null,
            projects: sectionFlags.projects ? '#projects' : null,
            about: sectionFlags.about ? '#about' : null,
            experience: sectionFlags.experience ? '#experience' : null,
            skills: sectionFlags.skills ? '#experience' : null,
            contact: sectionFlags.contact ? '#contact' : null
        };

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var targetHref = sectionToNav[entry.target.id];
                    setActiveLinkByHref(targetHref);
                }
            });
        }, {
            rootMargin: '-20% 0px -60% 0px',
            threshold: 0
        });

        sections.forEach(function (section) {
            observer.observe(section);
        });

        // Fallback for the final section: near document bottom, force Contact active.
        function syncBottomSectionHighlight() {
            if (window.scrollY <= 8) {
                setActiveLinkByHref(null);
                return;
            }

            var scrollBottom = window.scrollY + window.innerHeight;
            var docBottom = document.documentElement.scrollHeight;
            if (contactHref && docBottom - scrollBottom <= 2) {
                setActiveLinkByHref(contactHref);
            }
        }

        window.addEventListener('scroll', syncBottomSectionHighlight, { passive: true });
        window.addEventListener('resize', syncBottomSectionHighlight, { passive: true });
        syncBottomSectionHighlight();

        navLinks.forEach(function (link) {
            link.addEventListener('mouseenter', function () {
                moveIndicator(link);
            });
        });

        navLinksWrap.addEventListener('mouseleave', function () {
            if (activeLink) {
                moveIndicator(activeLink);
            }
        });

        window.addEventListener('resize', function () {
            if (activeLink) {
                moveIndicator(activeLink);
            }
        }, { passive: true });
    }

    /* ----------------------------------------------------------------------
       3. API FETCH HELPER
       ---------------------------------------------------------------------- */

    async function fetchJSON(url) {
        var res = await fetch(url);
        return res.json();
    }

    function postTrackingEvent(url, payload) {
        var body = JSON.stringify(payload || {});
        if (navigator.sendBeacon) {
            var blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
            return;
        }

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true
        }).catch(function () {
            // Best-effort tracking only.
        });
    }

    function setupButtonClickTracking() {
        var clickSelector = [
            '.contact-action',
            '.project-card',
            '.project-link'
        ].join(', ');

        document.addEventListener('click', function (event) {
            var target = event.target.closest(clickSelector);
            if (!target) return;

            var clickArea = target.closest('.contact-action') ? 'contact' : 'projects';
            var clickTarget = null;

            if (clickArea === 'contact') {
                if (target.dataset.track) {
                    clickTarget = target.dataset.track;
                } else if (target.getAttribute && target.getAttribute('href')) {
                    clickTarget = target.getAttribute('href');
                }
            } else {
                var projectCard = target.closest('.project-card');
                var projectTitleEl = projectCard ? projectCard.querySelector('.project-title') : null;
                if (projectTitleEl && projectTitleEl.textContent) {
                    clickTarget = projectTitleEl.textContent.trim();
                } else if (target.classList.contains('project-link')) {
                    clickTarget = 'project-link';
                } else if (target.getAttribute && target.getAttribute('href')) {
                    clickTarget = target.getAttribute('href');
                }
            }

            var text = (target.textContent || '').trim().replace(/\s+/g, ' ');
            var payload = {
                source: 'contact_projects_tracking',
                area: clickArea,
                click_target: clickTarget,
                tag: target.tagName ? target.tagName.toLowerCase() : 'unknown',
                id: target.id || null,
                class_name: target.className || null,
                text: text ? text.slice(0, 120) : null,
                href: target.getAttribute && target.getAttribute('href')
                    ? target.getAttribute('href')
                    : null,
                current_path: window.location.pathname
            };

            postTrackingEvent('/api/events/click', payload);
        }, { passive: true });
    }

    /* ----------------------------------------------------------------------
       4. SVG ICON MAP
       ---------------------------------------------------------------------- */

    var SVG_ICONS = {
        database: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>',
        transfer: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 16l-4-4 4-4"/><path d="M3 12h18"/><path d="M17 8l4 4-4 4"/></svg>',
        gear: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        lightbulb: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>'
    };

    function getServiceIcon(iconName) {
        return SVG_ICONS[iconName] || SVG_ICONS.gear;
    }

    /* ----------------------------------------------------------------------
       5. UI ICONS
       ---------------------------------------------------------------------- */

    var UI_ICONS = {
        arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
        arrowUpRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
        mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-10 6L2 7"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>',
        linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM7.1 20.5H3.5V9h3.6v11.5ZM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0Z"/></svg>',
        cv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>'
    };

    /* ----------------------------------------------------------------------
       6. DURATION CALCULATION
       ---------------------------------------------------------------------- */

    function calculateDuration(startStr, endStr) {
        var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        function parse(s) {
            if (s.toLowerCase() === 'present') return new Date();
            var parts = s.trim().split(/\s+/);
            var monthIdx = months.findIndex(function (m) {
                return parts[0].toLowerCase().startsWith(m);
            });
            return new Date(parseInt(parts[1], 10), monthIdx);
        }

        var start = parse(startStr);
        var end = parse(endStr);
        var totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        var years = Math.floor(totalMonths / 12);
        var mos = totalMonths % 12;

        if (years > 0 && mos > 0) {
            return years + ' yr' + (years > 1 ? 's' : '') + ' ' + mos + ' mo' + (mos > 1 ? 's' : '');
        }
        if (years > 0) {
            return years + ' yr' + (years > 1 ? 's' : '');
        }
        return mos + ' mo' + (mos > 1 ? 's' : '');
    }

    /* ----------------------------------------------------------------------
       7. METRIC VALUE PARSING
       ---------------------------------------------------------------------- */

    function parseMetricValue(valueStr) {
        // Examples: "5+", "15+", "100M+", "10+"
        var match = valueStr.match(/^(\d+)(.*)$/);
        if (!match) return { target: 0, suffix: valueStr };
        return { target: parseInt(match[1], 10), suffix: match[2] || '' };
    }

    /* ----------------------------------------------------------------------
       8. SECTION RENDERERS
       ---------------------------------------------------------------------- */

    function renderHero(profile, sectionFlags) {
        var container = document.getElementById('hero-content');
        if (!container) return;

        var fullName = profile.first_name + ' ' + profile.last_name;

        // Render the real hero title in both cases so layout is identical. When
        // the loader brand exists, keep it hidden (but laid out) so the floating
        // brand can morph onto its exact final position, then reveal it.
        var loaderBrand = document.querySelector('.loader-brand');
        var heroTitleInner =
            '<img src="/static/images/gold-logo-transparent-bg.PNG" alt="freelanxur" class="logo-img" height="60">' +
            '<span class="title-text">freelanxur</span>';
        var titleHtml = loaderBrand
            ? '<div class="hero-title hero-title-morph-target" style="visibility: hidden;">' + heroTitleInner + '</div>'
            : '<div class="hero-title">' + heroTitleInner + '</div>';

        var taglineHtml = profile.tagline
            ? '<p class="hero-tagline">' + escapeHTML(profile.tagline) + '</p>'
            : '';

        var ctas = [];
        if (sectionFlags.projects) {
            ctas.push('<a class="btn btn-accent" href="#projects">See my work ' + UI_ICONS.arrowRight + '</a>');
        }
        if (sectionFlags.contact) {
            ctas.push('<a class="btn btn-ghost" href="#contact">Get in touch</a>');
        }
        var ctasHtml = ctas.length ? '<div class="hero-ctas">' + ctas.join('') + '</div>' : '';

        container.innerHTML =
            '<p class="hero-greeting">Hi, I\'m</p>' +
            '<h1 class="hero-name">' + escapeHTML(fullName) + '</h1>' +
            titleHtml +
            taglineHtml +
            ctasHtml;

        // Apply staggered entrance to hero children (skip the morph target,
        // the floating brand animates into its place instead)
        var heroChildren = container.children;
        for (var i = 0; i < heroChildren.length; i++) {
            if (!heroChildren[i].classList.contains('hero-title-morph-target')) {
                heroChildren[i].classList.add('hero-stagger');
            }
        }
    }

    // Beams live in page coordinates on a fixed canvas, so one beam keeps travelling down the page as you scroll
    function setupBackgroundBeams() {
        var canvas = document.getElementById('bg-beams');
        if (!canvas || !canvas.getContext) return;

        var ctx = canvas.getContext('2d');
        var ANGLE = 28 * Math.PI / 180;
        var DX = Math.sin(ANGLE);
        var DY = Math.cos(ANGLE);
        var SLOPE = DX / DY;
        var STEP = 90 / DY;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        var vw = 0;
        var vh = 0;
        var pageH = 0;
        var beams = [];
        var colors = {};

        function readColors() {
            var light = document.documentElement.dataset.theme === 'light';
            colors.rgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '245, 197, 66';
            colors.track = light ? 'rgba(0, 0, 0, 0.045)' : 'rgba(255, 255, 255, 0.035)';
            colors.tip = light ? 'rgb(' + colors.rgb + ')' : '#fff';
        }

        // Track k is the line x = k * STEP + y * SLOPE (page coordinates), clipped to the page
        function track(k) {
            var c = k * STEP;
            var y0 = c >= 0 ? 0 : -c / SLOPE;
            var y1 = Math.min(pageH, (vw - c) / SLOPE);
            return { c: c, y0: y0, len: Math.max(0, (y1 - y0) / DY) };
        }

        function spawn(beam, midFlight) {
            var kMin = Math.ceil(-pageH * SLOPE / STEP);
            var kMax = Math.floor(vw / STEP);
            var maxLen = Math.min(vw / DX, pageH / DY);
            var t;
            // Weight by track length so beams are spread evenly over the page
            for (var tries = 0; tries < 20; tries++) {
                beam.k = kMin + Math.floor(Math.random() * (kMax - kMin + 1));
                t = track(beam.k);
                if (Math.random() * maxLen < t.len) break;
            }
            beam.size = 110 + Math.random() * 90;
            beam.speed = 0.35 + Math.random() * 0.3;
            beam.s = midFlight ? Math.random() * t.len : -Math.random() * 600;
        }

        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            vw = canvas.clientWidth;
            vh = canvas.clientHeight;
            pageH = Math.max(document.documentElement.scrollHeight, vh);
            canvas.width = Math.round(vw * dpr);
            canvas.height = Math.round(vh * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            var count = Math.max(6, Math.min(60, Math.round(4 * pageH / vh)));
            while (beams.length < count) {
                var beam = {};
                spawn(beam, true);
                beams.push(beam);
            }
            beams.length = count;
            draw();
        }

        function draw() {
            var sy = window.scrollY;
            ctx.clearRect(0, 0, vw, vh);

            ctx.lineWidth = 1;
            ctx.strokeStyle = colors.track;
            ctx.beginPath();
            var kFrom = Math.ceil(-(sy + vh) * SLOPE / STEP);
            var kTo = Math.floor((vw - sy * SLOPE) / STEP);
            for (var k = kFrom; k <= kTo; k++) {
                ctx.moveTo(k * STEP + sy * SLOPE, 0);
                ctx.lineTo(k * STEP + (sy + vh) * SLOPE, vh);
            }
            ctx.stroke();

            if (reduceMotion) return;

            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(' + colors.rgb + ', 0.55)';
            ctx.shadowBlur = 14;
            beams.forEach(function (b) {
                var t = track(b.k);
                var headS = Math.min(b.s, t.len);
                var tailS = Math.max(0, b.s - b.size);
                if (headS <= tailS) return;

                var hy = t.y0 + headS * DY;
                var ty = t.y0 + tailS * DY;
                if (hy < sy - 20 || ty > sy + vh + 20) return;

                var hx = t.c + hy * SLOPE;
                var tx = t.c + ty * SLOPE;
                var g = ctx.createLinearGradient(tx, ty - sy, hx, hy - sy);
                g.addColorStop(0, 'rgba(' + colors.rgb + ', 0)');
                g.addColorStop(0.85, 'rgba(' + colors.rgb + ', 0.85)');
                g.addColorStop(1, colors.tip);
                ctx.strokeStyle = g;
                ctx.beginPath();
                ctx.moveTo(tx, ty - sy);
                ctx.lineTo(hx, hy - sy);
                ctx.stroke();
            });
            ctx.shadowBlur = 0;
        }

        readColors();
        resize();
        window.addEventListener('resize', resize);
        if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);
        new MutationObserver(function () {
            readColors();
            draw();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        if (reduceMotion) {
            window.addEventListener('scroll', function () { requestAnimationFrame(draw); }, { passive: true });
            return;
        }

        var last = 0;
        requestAnimationFrame(function frame(now) {
            var dt = last ? Math.min(50, now - last) : 16;
            last = now;
            beams.forEach(function (b) {
                b.s += b.speed * dt;
                if (b.s - b.size > track(b.k).len) spawn(b, false);
            });
            draw();
            requestAnimationFrame(frame);
        });
    }

    function renderMetrics(metrics) {
        var container = document.getElementById('metrics-content');
        if (!container) return;

        var html = '';
        metrics.forEach(function (m, i) {
            var parsed = parseMetricValue(m.value);
            html +=
                '<div class="metric-card glow-card animate-on-scroll" style="animation-delay: ' + (i * 0.08) + 's">' +
                    '<div class="metric-value" data-target="' + parsed.target + '" data-suffix="' + escapeHTML(parsed.suffix) + '">0</div>' +
                    '<div class="metric-label">' + escapeHTML(m.label) + '</div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderAbout(about, profile) {
        var container = document.getElementById('about-content');
        if (!container) return;

        var fullName = profile.first_name + ' ' + profile.last_name;
        var introHtml = about.about_website && about.about_website.trim()
            ? '<div class="about-tile about-intro glow-card animate-on-scroll">' +
                '<div class="about-tile-label">// why you\'re here</div>' +
                '<div class="about-text">' + about.about_website + '</div>' +
              '</div>'
            : '';

        container.innerHTML =
            introHtml +
            '<div class="about-tile about-photo-tile glow-card animate-on-scroll" style="animation-delay: 0.08s">' +
                '<img src="/static/images/profile-photo.png" alt="' + escapeHTML(fullName) + '" class="about-photo">' +
                '<div class="about-photo-caption">' +
                    '<span>' + escapeHTML(fullName) + '</span>' +
                    '<span class="about-photo-brand">' + escapeHTML(profile.title) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="about-tile about-me glow-card animate-on-scroll" style="animation-delay: 0.16s">' +
                '<div class="about-tile-label">// me</div>' +
                '<div class="about-text">' + about.about_me + '</div>' +
            '</div>' +
            '<div class="about-tile about-logo-tile glow-card animate-on-scroll" style="animation-delay: 0.24s">' +
                '<button type="button" class="about-logo-stage" aria-label="Turn the logo sideways" aria-pressed="false">' +
                    '<span class="about-logo-bars" aria-hidden="true">' +
                        '<span data-stage="E"></span><span data-stage="T"></span><span data-stage="L"></span>' +
                    '</span>' +
                '</button>' +
                '<div>' +
                    '<div class="about-tile-label">// the logo</div>' +
                    '<div class="about-text">' + about.about_logo + '</div>' +
                '</div>' +
            '</div>';

        // Touch devices have no hover, so let a tap flip the logo into a bar chart
        var stage = container.querySelector('.about-logo-stage');
        stage.addEventListener('click', function () {
            var tile = stage.closest('.about-logo-tile');
            tile.classList.toggle('flipped');
            stage.setAttribute('aria-pressed', String(tile.classList.contains('flipped')));
        });
    }

    function renderSkills(skills) {
        var container = document.getElementById('skills-content');
        if (!container) return;

        var html = '';
        skills.skills.forEach(function (s) {
            html +=
                '<div class="skill-item">' +
                    '<div class="skill-header">' +
                        '<span class="skill-name">' + escapeHTML(s.name) + '</span>' +
                    '</div>' +
                    '<div class="skill-bar">' +
                        '<div class="skill-fill" style="--skill-width: ' + s.percentage + '%" data-width="' + s.percentage + '"></div>' +
                    '</div>' +
                '</div>';
        });
        html += '<p class="skills-note">' + escapeHTML(skills.note) + '</p>';
        container.innerHTML = html;
    }

    function renderServices(services) {
        var container = document.getElementById('services-content');
        if (!container) return;

        var html = '';
        services.forEach(function (s, i) {
            html +=
                '<div class="service-card glow-card animate-on-scroll" style="animation-delay: ' + (i * 0.1) + 's">' +
                    '<div class="service-icon">' + getServiceIcon(s.icon) + '</div>' +
                    '<h3 class="service-title">' + escapeHTML(s.title) + '</h3>' +
                    '<p class="service-description">' + escapeHTML(s.description) + '</p>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderProjects(projects) {
        var container = document.getElementById('projects-content');
        if (!container) return;

        var html = '';
        projects.forEach(function (p, i) {
            var openable = p.link && !p.nda;
            var cardClasses = 'project-card glow-card animate-on-scroll' +
                (i === 0 ? ' project-card-featured' : '') +
                (p.nda ? ' nda' : '');
            var openAttrs = openable
                ? ' data-href="' + escapeHTML(p.link) + '" role="link" tabindex="0"'
                : '';

            var tagsHtml = p.tags.map(function (tag) {
                return '<span class="project-tag">' + escapeHTML(tag) + '</span>';
            }).join('');

            html +=
                '<div class="' + cardClasses + '" style="animation-delay: ' + (i * 0.08) + 's"' + openAttrs + '>' +
                    '<div class="project-card-top">' +
                        '<span class="project-index">' + String(i + 1).padStart(2, '0') + '</span>' +
                        (p.nda ? '<span class="nda-stamp">NDA &middot; Client work</span>' : '') +
                    '</div>' +
                    '<h3 class="project-title">' + escapeHTML(p.title) + '</h3>' +
                    '<p class="project-description">' + escapeHTML(p.description) + '</p>' +
                    '<div class="project-tags">' + tagsHtml + '</div>' +
                    (openable
                        ? '<a class="project-link" href="' + escapeHTML(p.link) + '" target="_blank" rel="noopener">View project ' + UI_ICONS.arrowUpRight + '</a>'
                        : '') +
                '</div>';
        });

        // Featured card takes two cells of the 3-column grid; GitHub card fills the last row
        var usedCells = projects.length + (projects.length ? 1 : 0);
        var githubSpan = 3 - (usedCells % 3);
        html +=
            '<a class="project-card project-card-github project-span-' + githubSpan + ' animate-on-scroll" href="https://github.com/rayleighxu7" target="_blank" rel="noopener" style="animation-delay: ' + (projects.length * 0.08) + 's">' +
                '<span class="github-card-text">More on GitHub</span>' +
                '<span class="github-card-handle">github.com/rayleighxu7 ' + UI_ICONS.arrowUpRight + '</span>' +
            '</a>';
        container.innerHTML = html;

        function openCard(card) {
            window.open(card.dataset.href, '_blank', 'noopener');
        }
        container.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;
            var card = e.target.closest('.project-card[data-href]');
            if (card) openCard(card);
        });
        container.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || e.target.closest('a')) return;
            var card = e.target.closest('.project-card[data-href]');
            if (card) openCard(card);
        });
    }

    function renderExperience(experience) {
        var container = document.getElementById('experience-content');
        if (!container) return;

        var html = '';
        experience.forEach(function (e, i) {
            var duration = calculateDuration(e.start_date, e.end_date);
            html +=
                '<div class="timeline-item ' + (i % 2 === 0 ? 'slide-left' : 'slide-right') + '">' +
                    '<div class="timeline-date">' + escapeHTML(e.start_date) + ' - ' + escapeHTML(e.end_date) + '</div>' +
                    '<div class="timeline-duration">' + escapeHTML(duration) + '</div>' +
                    '<div class="timeline-title">' + escapeHTML(e.title) + ' <span class="timeline-company">@ ' + escapeHTML(e.company) + '</span></div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderContact(contact) {
        var container = document.getElementById('contact-content');
        if (!container) return;

        var email = escapeHTML(contact.email);
        var socials = [
            { track: 'github', label: 'GitHub', href: 'https://' + contact.github, icon: UI_ICONS.github, external: true },
            { track: 'linkedin', label: 'LinkedIn', href: 'https://' + contact.linkedin, icon: UI_ICONS.linkedin, external: true },
            { track: 'download-cv', label: 'Download CV', href: '/api/download-cv', icon: UI_ICONS.cv, external: false }
        ];

        container.innerHTML =
            '<a class="btn btn-accent contact-action" data-track="email" href="mailto:' + email + '">' + UI_ICONS.mail + 'Email me</a>' +
            '<button type="button" class="copy-pill contact-action" data-track="copy-email" data-email="' + email + '" aria-label="Copy email address ' + email + '">' +
                '<span>' + email + '</span>' +
                '<span class="copy-pill-icon">' + UI_ICONS.copy + '</span>' +
            '</button>' +
            '<div class="contact-socials">' +
                socials.map(function (s) {
                    return '<a class="contact-social contact-action" data-track="' + s.track + '" data-label="' + s.label + '" aria-label="' + s.label + '" href="' + escapeHTML(s.href) + '"' +
                        (s.external ? ' target="_blank" rel="noopener"' : ' download') + '>' + s.icon + '</a>';
                }).join('') +
            '</div>';

        container.querySelector('.copy-pill').addEventListener('click', function () {
            var value = this.dataset.email;
            if (!navigator.clipboard) {
                showToast(value);
                return;
            }
            navigator.clipboard.writeText(value).then(function () {
                showToast('Email copied to clipboard');
            }, function () {
                showToast(value);
            });
        });
    }

    var toastTimer = null;

    function showToast(message) {
        var toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        // Force a reflow so the entrance transition runs on first use
        void toast.offsetWidth;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 1800);
    }

    /* ----------------------------------------------------------------------
       9. HTML ESCAPE UTILITY
       ---------------------------------------------------------------------- */

    var escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, function (ch) { return escapeMap[ch]; });
    }

    /* ----------------------------------------------------------------------
       10. SCROLL ANIMATIONS -- Intersection Observer
       ---------------------------------------------------------------------- */

    function setupScrollAnimations() {
        var animElements = document.querySelectorAll('.animate-on-scroll');
        if (!animElements.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-visible');
                    observer.unobserve(entry.target);

                    // If this is a metric card, fire count-up
                    var metricValue = entry.target.querySelector('.metric-value[data-target]');
                    if (metricValue && entry.target.classList.contains('metric-card')) {
                        animateCountUp(metricValue);
                    }
                }
            });
        }, { threshold: 0.1 });

        animElements.forEach(function (el) {
            observer.observe(el);
        });

        // Skills-specific observer: animate skill bars when the skills section enters view
        var skillsSection = document.getElementById('skills');
        if (skillsSection) {
            var skillsObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var fills = entry.target.querySelectorAll('.skill-fill');
                        fills.forEach(function (fill) {
                            fill.classList.add('animate');
                            fill.style.width = fill.dataset.width + '%';
                        });
                        skillsObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            skillsObserver.observe(skillsSection);
        }
    }

    // Number section eyebrows in page order, so disabled sections leave no gaps
    function setupSectionNumbers() {
        document.querySelectorAll('.section-num').forEach(function (el, i) {
            el.textContent = String(i + 1).padStart(2, '0') + ' / ';
        });
    }

    function setupCardGlow() {
        // Only on devices with hover capability
        if (!window.matchMedia('(hover: hover)').matches) return;

        document.addEventListener('mousemove', function (e) {
            var card = e.target.closest('.glow-card');
            if (!card) return;
            var rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
            card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
        }, { passive: true });
    }

    function setupTimelineAnimations() {
        var timeline = document.querySelector('.timeline');
        if (!timeline) return;

        // Animate the timeline line
        var timelineObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('timeline-visible');
                    timelineObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        timelineObserver.observe(timeline);

        // Animate individual timeline items
        var items = timeline.querySelectorAll('.timeline-item');
        var itemObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('slide-visible');
                    itemObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        items.forEach(function (item, i) {
            item.style.transitionDelay = (i * 0.15) + 's';
            itemObserver.observe(item);
        });
    }

    function setupMagneticButtons() {
        if (!window.matchMedia('(hover: hover)').matches) return;

        var buttons = document.querySelectorAll('.btn');
        buttons.forEach(function (btn) {
            btn.classList.add('btn-magnetic');

            btn.addEventListener('mousemove', function (e) {
                var rect = btn.getBoundingClientRect();
                var x = e.clientX - rect.left - rect.width / 2;
                var y = e.clientY - rect.top - rect.height / 2;
                var maxMove = 4;
                var moveX = (x / rect.width) * maxMove * 2;
                var moveY = (y / rect.height) * maxMove * 2;
                btn.style.transform = 'translate(' + moveX + 'px, ' + moveY + 'px)';
            });

            btn.addEventListener('mouseleave', function () {
                btn.style.transform = '';
            });
        });
    }

    function setupBackToTop() {
        var btn = document.getElementById('back-to-top');
        var hero = document.querySelector('.hero-section');
        if (!btn || !hero) return;

        var heroHeight = hero.offsetHeight;
        window.addEventListener('resize', function () {
            heroHeight = hero.offsetHeight;
        }, { passive: true });

        window.addEventListener('scroll', function () {
            if (window.scrollY > heroHeight) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }, { passive: true });

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ----------------------------------------------------------------------
       11. COUNT-UP ANIMATION
       ---------------------------------------------------------------------- */

    function animateCountUp(element) {
        if (element.dataset.animated === '1') {
            return;
        }
        element.dataset.animated = '1';

        var target = parseInt(element.dataset.target, 10);
        var suffix = element.dataset.suffix || '';
        var duration = 2000;
        var start = performance.now();

        function update(now) {
            var elapsed = Math.max(0, now - start);

            if (elapsed < duration) {
                var progress = Math.min(1, elapsed / duration);
                var eased = 1 - Math.pow(1 - progress, 3);
                var current = Math.min(target, Math.round(target * eased));
                element.textContent = current + suffix;
                requestAnimationFrame(update);
            } else {
                // Done - ensure exact target
                element.textContent = target + suffix;
            }
        }

        requestAnimationFrame(update);
    }

    /* ----------------------------------------------------------------------
       12. INIT
       ---------------------------------------------------------------------- */

    async function init(dataPromise, sectionFlags) {
        // Theme and navbar can run immediately
        setupThemeToggle();
        setupNavbar();
        setupBackgroundBeams();

        try {
            var results = await dataPromise;

            var profile    = results[0];
            var metrics    = results[1];
            var about      = results[2];
            var skills     = results[3];
            var services   = results[4];
            var projects   = results[5];
            var experience = results[6];
            var contact    = results[7];

            if (sectionFlags.hero) {
                renderHero(profile, sectionFlags);
                setupHeroParallax();
            }
            if (sectionFlags.metrics && metrics) {
                renderMetrics(metrics);
            }
            if (sectionFlags.services && services) {
                renderServices(services);
            }
            if (sectionFlags.projects && projects) {
                renderProjects(projects);
            }
            if (sectionFlags.about && about) {
                renderAbout(about, profile);
            }
            if (sectionFlags.experience && experience) {
                renderExperience(experience);
            }
            if (sectionFlags.skills && skills) {
                renderSkills(skills);
            }
            if (sectionFlags.contact && contact) {
                renderContact(contact);
            }

            setupSectionNumbers();
            setupScrollAnimations();
            setupCardGlow();
            setupTimelineAnimations();
            setupMagneticButtons();
            setupBackToTop();
            setupNavHighlighting();

            var footerText = document.getElementById('footer-text');
            if (footerText) {
                footerText.textContent = profile.footer;
            }
        } catch (err) {
            console.error('Failed to load portfolio data:', err);
        }
    }

    // Theme must apply before loader (so loader has correct bg)
    applyTheme(getTheme());

    var sectionConfig = getSectionConfig();
    var sectionFlags = getSectionFlags(sectionConfig);

    // Start fetching data immediately (in parallel with loader animation)
    var dataPromise = fetchSectionData(sectionFlags);
    setupButtonClickTracking();

    runPageLoader(function () {
        init(dataPromise, sectionFlags);
    });
})();
