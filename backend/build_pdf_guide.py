#!/usr/bin/env python3
"""Конвертировать docs/DASHBOARD_USER_GUIDE.md в красивый профессиональный PDF
для приватного распространения партнёрам.

Структура PDF:
  1. Обложка (TUSHUN Dashboard / Partner User Guide)
  2. Страница конфиденциальности
  3. Контент из markdown (с правильной типографикой)
  4. Финальная страница с контактной информацией

Запуск: python build_pdf_guide.py
Выход: TUSHUN_Dashboard_User_Guide.pdf (в текущей папке)
"""
import os
import re
import sys
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, NextPageTemplate, PageBreak, PageTemplate,
    Paragraph, Preformatted, Spacer, Table, TableStyle,
)


# ==============================================================================
# Шрифты — Arial Unicode для кириллицы и эмодзи
# ==============================================================================
FONT_REG = 'ArialUni'
FONT_BOLD = 'ArialUni-Bold'
ARIAL_UNI = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
HELVETICA_BOLD = '/System/Library/Fonts/Helvetica.ttc'  # fallback, используем Helvetica-Bold

if os.path.exists(ARIAL_UNI):
    pdfmetrics.registerFont(TTFont(FONT_REG, ARIAL_UNI))
    # Arial Unicode не имеет отдельного bold-варианта в одном TTF — используем тот же
    pdfmetrics.registerFont(TTFont(FONT_BOLD, ARIAL_UNI))
else:
    print('⚠ Arial Unicode не найден, использую Helvetica (без кириллицы)')
    FONT_REG = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'


# ==============================================================================
# Цветовая палитра (под бренд TUSHUN — золотой + чёрный)
# ==============================================================================
GOLD = colors.HexColor('#d4af37')
DARK = colors.HexColor('#1a1a1a')
GREY = colors.HexColor('#666666')
LIGHT_GREY = colors.HexColor('#f5f5f5')
RED = colors.HexColor('#c0392b')


# ==============================================================================
# Стили
# ==============================================================================
def make_styles():
    s = getSampleStyleSheet()

    title = ParagraphStyle(
        name='CoverTitle',
        fontName=FONT_BOLD, fontSize=42, textColor=GOLD,
        alignment=TA_CENTER, leading=50, spaceAfter=20,
    )
    subtitle = ParagraphStyle(
        name='CoverSubtitle',
        fontName=FONT_REG, fontSize=18, textColor=DARK,
        alignment=TA_CENTER, leading=24, spaceAfter=80,
    )
    cover_meta = ParagraphStyle(
        name='CoverMeta',
        fontName=FONT_REG, fontSize=10, textColor=GREY,
        alignment=TA_CENTER, leading=14,
    )
    confidential_title = ParagraphStyle(
        name='ConfTitle',
        fontName=FONT_BOLD, fontSize=24, textColor=RED,
        alignment=TA_CENTER, leading=30, spaceAfter=20,
    )
    confidential_body = ParagraphStyle(
        name='ConfBody',
        fontName=FONT_REG, fontSize=12, textColor=DARK,
        alignment=TA_JUSTIFY, leading=18, spaceAfter=12,
    )
    h1 = ParagraphStyle(
        name='H1',
        fontName=FONT_BOLD, fontSize=22, textColor=GOLD,
        alignment=TA_LEFT, leading=28, spaceBefore=24, spaceAfter=14,
        keepWithNext=True,
    )
    h2 = ParagraphStyle(
        name='H2',
        fontName=FONT_BOLD, fontSize=16, textColor=DARK,
        alignment=TA_LEFT, leading=22, spaceBefore=16, spaceAfter=10,
        keepWithNext=True,
    )
    h3 = ParagraphStyle(
        name='H3',
        fontName=FONT_BOLD, fontSize=13, textColor=DARK,
        alignment=TA_LEFT, leading=18, spaceBefore=10, spaceAfter=6,
        keepWithNext=True,
    )
    body = ParagraphStyle(
        name='Body',
        fontName=FONT_REG, fontSize=11, textColor=DARK,
        alignment=TA_JUSTIFY, leading=16, spaceAfter=8,
    )
    bullet = ParagraphStyle(
        name='Bullet',
        fontName=FONT_REG, fontSize=11, textColor=DARK,
        alignment=TA_LEFT, leading=16, leftIndent=18, bulletIndent=4,
        spaceAfter=4,
    )
    quote = ParagraphStyle(
        name='Quote',
        fontName=FONT_REG, fontSize=10, textColor=GREY,
        alignment=TA_LEFT, leading=15, leftIndent=14, rightIndent=8,
        borderColor=GOLD, borderWidth=0, borderPadding=(4, 0, 4, 8),
        spaceAfter=8,
    )
    code = ParagraphStyle(
        name='Code',
        fontName='Courier', fontSize=9, textColor=DARK,
        alignment=TA_LEFT, leading=12, leftIndent=10,
        backColor=LIGHT_GREY, borderColor=GREY, borderWidth=0.5,
        borderPadding=4, spaceAfter=8,
    )
    contact_title = ParagraphStyle(
        name='ContactTitle',
        fontName=FONT_BOLD, fontSize=20, textColor=GOLD,
        alignment=TA_CENTER, leading=26, spaceAfter=20,
    )
    contact_body = ParagraphStyle(
        name='ContactBody',
        fontName=FONT_REG, fontSize=12, textColor=DARK,
        alignment=TA_CENTER, leading=20, spaceAfter=10,
    )

    return {
        'title': title, 'subtitle': subtitle, 'meta': cover_meta,
        'conf_title': confidential_title, 'conf_body': confidential_body,
        'h1': h1, 'h2': h2, 'h3': h3, 'body': body,
        'bullet': bullet, 'quote': quote, 'code': code,
        'contact_title': contact_title, 'contact_body': contact_body,
    }


# ==============================================================================
# Парсинг markdown в reportlab Flowables
# ==============================================================================
def md_inline(text: str) -> str:
    """Преобразовать markdown inline-разметку в reportlab HTML-теги."""
    # Code: `text` → <font face="Courier" backColor="#f5f5f5">text</font>
    text = re.sub(r'`([^`\n]+)`', r'<font face="Courier" color="#7a4f00">\1</font>', text)
    # Bold: **text**
    text = re.sub(r'\*\*([^\*]+)\*\*', r'<b>\1</b>', text)
    # Italic: *text*
    text = re.sub(r'(?<!\*)\*([^\*\n]+)\*(?!\*)', r'<i>\1</i>', text)
    # Links: [text](url)
    #   - якорные ссылки (#anchor) → просто текст без <link>
    #   - http/https → кликабельная <link>
    def _link(m):
        label, target = m.group(1), m.group(2)
        if target.startswith('#'):
            # внутренняя якорная ссылка (markdown TOC) — оставляем текст
            return f'<b>{label}</b>'
        return f'<link href="{target}" color="#0066cc">{label}</link>'

    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', _link, text)
    # Escape <,>,& только если не наш HTML тег
    # (упрощённо — оставляем как есть, наш markdown не содержит сырого HTML)
    return text


def parse_table(lines, idx):
    """Парсит markdown table начиная с lines[idx]. Возвращает (table_data, new_idx)."""
    rows = []
    while idx < len(lines) and lines[idx].strip().startswith('|'):
        line = lines[idx].strip()
        # Разделитель типа |---|---|
        if re.match(r'^\|[\s\-:|]+\|\s*$', line):
            idx += 1
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        rows.append(cells)
        idx += 1
    return rows, idx


def md_to_flowables(md_text: str, styles: dict) -> list:
    """Конвертировать markdown в список Flowable."""
    flowables = []
    lines = md_text.split('\n')
    i = 0
    in_code = False
    code_lines = []
    in_list = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Code blocks ```...```
        if stripped.startswith('```'):
            if in_code:
                # End
                if code_lines:
                    flowables.append(Preformatted(
                        '\n'.join(code_lines),
                        styles['code']))
                code_lines = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # Skip horizontal rule
        if re.match(r'^-{3,}$', stripped):
            flowables.append(Spacer(1, 6))
            flowables.append(_horizontal_line())
            i += 1
            continue

        # Empty line
        if not stripped:
            in_list = False
            i += 1
            continue

        # Headings
        if stripped.startswith('# '):
            flowables.append(Paragraph(md_inline(stripped[2:]), styles['h1']))
            i += 1
            continue
        if stripped.startswith('## '):
            flowables.append(Paragraph(md_inline(stripped[3:]), styles['h2']))
            i += 1
            continue
        if stripped.startswith('### '):
            flowables.append(Paragraph(md_inline(stripped[4:]), styles['h3']))
            i += 1
            continue
        if stripped.startswith('#### '):
            # H4 = меньший H3
            flowables.append(Paragraph('<b>' + md_inline(stripped[5:]) + '</b>', styles['h3']))
            i += 1
            continue

        # Tables (лидирующая |)
        if stripped.startswith('|') and stripped.count('|') >= 2:
            rows, i = parse_table(lines, i)
            if rows:
                flowables.append(_make_table(rows))
            continue

        # Lists
        m = re.match(r'^[-*+]\s+(.+)$', stripped)
        if m:
            flowables.append(Paragraph(
                '• ' + md_inline(m.group(1)),
                styles['bullet']))
            in_list = True
            i += 1
            continue
        m = re.match(r'^\d+\.\s+(.+)$', stripped)
        if m:
            flowables.append(Paragraph(
                md_inline(m.group(1)),
                styles['bullet']))
            in_list = True
            i += 1
            continue

        # Quote
        if stripped.startswith('>'):
            content = stripped.lstrip('>').strip()
            flowables.append(Paragraph(md_inline(content), styles['quote']))
            i += 1
            continue

        # Plain paragraph
        flowables.append(Paragraph(md_inline(stripped), styles['body']))
        i += 1

    return flowables


def _horizontal_line():
    """Тонкая золотистая линия как separator."""
    t = Table([['']], colWidths=['100%'], rowHeights=[1])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GOLD),
    ]))
    return t


def _make_table(rows):
    """Создать reportlab Table из markdown-строк."""
    if not rows:
        return Spacer(1, 0)
    # Первая строка — header (если markdown table)
    header = rows[0]
    body = rows[1:]
    data = [[Paragraph(md_inline(c), ParagraphStyle(
        name='td', fontName=FONT_REG, fontSize=9, leading=12,
        alignment=TA_LEFT)) for c in r] for r in [header] + body]

    n_cols = len(header)
    col_w = (17 * cm) / n_cols
    t = Table(data, colWidths=[col_w] * n_cols, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GOLD),
        ('TEXTCOLOR', (0, 0), (-1, 0), DARK),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.25, GREY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
    ]))
    return t


# ==============================================================================
# Cover, Confidentiality, Contact pages
# ==============================================================================
def cover_page_flowables(styles):
    return [
        Spacer(1, 6 * cm),
        Paragraph('TUSHUN', styles['title']),
        Paragraph('DASHBOARD', styles['title']),
        Spacer(1, 1 * cm),
        Paragraph('Partner User Guide', styles['subtitle']),
        Spacer(1, 5 * cm),
        Paragraph('Distribution: Authorized Partners Only', styles['meta']),
        Paragraph(f'Issued: {datetime.now().strftime("%Y-%m-%d")}', styles['meta']),
        Paragraph('Version 1.0', styles['meta']),
        PageBreak(),
    ]


def confidentiality_page_flowables(styles):
    return [
        Spacer(1, 3 * cm),
        Paragraph('🔒 CONFIDENTIAL', styles['conf_title']),
        Paragraph('Private Partner Documentation', styles['subtitle']),
        Spacer(1, 1 * cm),
        Paragraph(
            '<b>This document is confidential</b> and intended solely for authorized partners '
            'of TUSHUN Dashboard. By reading this document you agree to the following:',
            styles['conf_body']),
        Spacer(1, 0.5 * cm),
        Paragraph('• Do not share this document with unauthorized parties.', styles['bullet']),
        Paragraph('• Do not post any part of this document publicly online.', styles['bullet']),
        Paragraph('• Do not disclose login credentials, URLs, or internal procedures '
                  'mentioned in this guide.', styles['bullet']),
        Paragraph('• If you no longer require access, please request removal from the '
                  'distribution list.', styles['bullet']),
        Spacer(1, 1 * cm),
        Paragraph(
            'Unauthorized distribution may result in revocation of access to the dashboard '
            'and termination of partnership agreements.',
            styles['conf_body']),
        Spacer(1, 1 * cm),
        Paragraph('For inquiries: amrekabilash@gmail.com', styles['contact_body']),
        PageBreak(),
    ]


def contact_page_flowables(styles):
    return [
        PageBreak(),
        Spacer(1, 6 * cm),
        Paragraph('Contact Information', styles['contact_title']),
        Spacer(1, 1 * cm),
        Paragraph('TUSHUN Team', styles['contact_body']),
        Paragraph('<b>Email:</b> <font color="#0066cc">amrekabilash@gmail.com</font>',
                  styles['contact_body']),
        Spacer(1, 1 * cm),
        Paragraph('Dashboard URL', styles['contact_body']),
        Paragraph('<font color="#0066cc">https://tushun-dashboard.vercel.app</font>',
                  styles['contact_body']),
        Spacer(1, 2 * cm),
        Paragraph('— End of Guide —', styles['meta']),
        Paragraph(
            f'Generated on {datetime.now().strftime("%Y-%m-%d %H:%M")}',
            styles['meta']),
    ]


# ==============================================================================
# Page header / footer (page numbers, branding)
# ==============================================================================
def make_page_decorator(total_pages_holder=None):
    """Возвращает функцию-callback которая рисует header/footer на каждой странице."""

    def on_page(canvas, doc):
        page_num = canvas.getPageNumber()
        canvas.saveState()

        # На обложке — только сноска
        if page_num == 1:
            canvas.setFont(FONT_REG, 8)
            canvas.setFillColor(GREY)
            canvas.drawCentredString(A4[0] / 2, 1.5 * cm,
                                     'CONFIDENTIAL — Authorized Partners Only')
            canvas.restoreState()
            return

        # Header line
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(2 * cm, A4[1] - 1.5 * cm, A4[0] - 2 * cm, A4[1] - 1.5 * cm)

        canvas.setFont(FONT_REG, 8)
        canvas.setFillColor(GOLD)
        canvas.drawString(2 * cm, A4[1] - 1.2 * cm, 'TUSHUN Dashboard')
        canvas.setFillColor(GREY)
        canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.2 * cm,
                                'Partner User Guide · CONFIDENTIAL')

        # Footer line + page number
        canvas.setStrokeColor(colors.HexColor('#cccccc'))
        canvas.line(2 * cm, 1.6 * cm, A4[0] - 2 * cm, 1.6 * cm)

        canvas.setFont(FONT_REG, 8)
        canvas.setFillColor(GREY)
        canvas.drawString(2 * cm, 1.1 * cm, '© TUSHUN — Distribution: Authorized Partners')
        canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f'Page {page_num}')

        canvas.restoreState()

    return on_page


# ==============================================================================
# MAIN
# ==============================================================================
def main():
    repo_md = Path('/tmp/tushun-dashboard/docs/DASHBOARD_USER_GUIDE.md')
    if not repo_md.exists():
        # Fallback — if removed from repo (after step 1), use local copy
        backup = Path('/Users/amrekhavlaash/design123/huashu-design/tushun-app/'
                      'TUSHUN_user_guide_backup.md')
        if backup.exists():
            repo_md = backup
        else:
            print('✗ Markdown source not found:', repo_md)
            sys.exit(1)

    md_text = repo_md.read_text(encoding='utf-8')
    output = Path.cwd() / 'TUSHUN_Dashboard_User_Guide.pdf'

    doc = BaseDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title='TUSHUN Dashboard — Partner User Guide',
        author='TUSHUN Team',
        subject='Private Partner Documentation',
        keywords='TUSHUN, dashboard, user guide, partners, confidential',
        creator='TUSHUN PDF Builder v1.0',
    )

    # Single template — Frame для контента, on_page для header/footer
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        A4[0] - 2 * doc.leftMargin, A4[1] - 2 * doc.topMargin,
        id='main', showBoundary=0,
    )

    on_page = make_page_decorator()
    template = PageTemplate(id='main', frames=[frame], onPage=on_page)
    doc.addPageTemplates([template])

    styles = make_styles()

    flowables = []
    flowables.extend(cover_page_flowables(styles))
    flowables.extend(confidentiality_page_flowables(styles))
    flowables.extend(md_to_flowables(md_text, styles))
    flowables.extend(contact_page_flowables(styles))

    doc.build(flowables)

    size_kb = output.stat().st_size / 1024
    print(f'✓ PDF created: {output}')
    print(f'  size: {size_kb:.1f} KB')

    # Get page count via reading PDF
    try:
        with open(output, 'rb') as f:
            content = f.read()
        # crude page count from PDF
        import re as re_mod
        pages = len(re_mod.findall(rb'/Type\s*/Page[^s]', content))
        print(f'  pages: ~{pages}')
    except Exception:
        pass


if __name__ == '__main__':
    main()
